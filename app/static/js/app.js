/* =====================================================================
   NestMatch Core Application Logic & State Controller
   ===================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    deck: [],
    matches: [],
    allVibes: [],
    selectedForCompare: new Set(),
    activeProp: null,
    activeTab: 'discover-tab',
    filters: {
      maxPrice: 1600000,
      commuteHub: 'Downtown Tech Core',
      vibes: []
    }
  };

  // Controllers
  let swipeController = null;
  let mapRadar = null;

  // DOM Elements
  const cardStackEl = document.getElementById('card-stack');
  const matchesBadgeEl = document.getElementById('matches-badge');
  const compareBadgeEl = document.getElementById('compare-badge');
  const matchesGridEl = document.getElementById('matches-grid');
  const matchesEmptyEl = document.getElementById('matches-empty');
  const compareTrayEl = document.getElementById('compare-tray');
  const toastContainerEl = document.getElementById('toast-container');
  const filterModalEl = document.getElementById('filter-modal');
  const propertyDrawerEl = document.getElementById('property-drawer');

  // Initialize App
  init();

  async function init() {
    setupTabNavigation();
    setupSwipeActions();
    setupKeyboardShortcuts();
    setupFilters();
    setupMortgageLab();

    mapRadar = new MapRadar('leaflet-map');

    await fetchAllVibes();
    await loadDeck();
    await refreshMatchesCount();
  }

  /* -------------------------------------------------------------------
     1. TAB NAVIGATION
     ------------------------------------------------------------------- */
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        switchTab(targetTab);
      });
    });

    document.getElementById('brand-logo').addEventListener('click', () => {
      switchTab('discover-tab');
    });
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    if (tabId === 'matches-tab') {
      loadMatches('all');
    } else if (tabId === 'map-tab') {
      if (mapRadar) {
        mapRadar.init();
        // Give Leaflet map both current deck and matches
        const allRelevantProps = [...state.deck, ...state.matches];
        const uniqueProps = Array.from(new Map(allRelevantProps.map(p => [p.id, p])).values());
        mapRadar.setProperties(uniqueProps);
      }
    } else if (tabId === 'compare-tab') {
      renderComparisonView();
    }
  }

  /* -------------------------------------------------------------------
     2. DISCOVER & SWIPE CARD DECK
     ------------------------------------------------------------------- */
  async function loadDeck() {
    cardStackEl.innerHTML = `
      <div class="loading-spinner-wrapper">
        <div class="glow-spinner"></div>
        <p>Curating homes matching your aesthetic...</p>
      </div>
    `;

    try {
      const vibesQuery = state.filters.vibes.length > 0 ? `&vibes=${encodeURIComponent(state.filters.vibes.join(','))}` : '';
      const res = await fetch(`/api/properties/deck?max_price=${state.filters.maxPrice}&commute_dest=${encodeURIComponent(state.filters.commuteHub)}${vibesQuery}`);
      const data = await res.json();
      state.deck = data.properties || [];
      renderDeck();
    } catch (err) {
      console.error('Error fetching deck:', err);
      cardStackEl.innerHTML = `<div class="empty-deck-card"><h3>Error loading properties</h3><p>Please refresh the page.</p></div>`;
    }
  }

  function renderDeck() {
    cardStackEl.innerHTML = '';

    if (state.deck.length === 0) {
      renderEmptyDeck();
      return;
    }

    // Initialize SwipeController if needed
    swipeController = new SwipeController(cardStackEl, {
      onSwipe: (action, property) => handleSwipeComplete(action, property),
      onCardClick: (property) => openPropertyDrawer(property)
    });

    // We only render top 3 cards in DOM for high 60fps performance
    const cardsToRender = state.deck.slice(0, 3);
    cardsToRender.forEach((prop, idx) => {
      const cardEl = createCardElement(prop, idx);
      cardStackEl.appendChild(cardEl);
      if (idx === 0) {
        swipeController.attachCard(cardEl, prop);
        state.activeProp = prop;
      }
    });
  }

  function createCardElement(prop, stackIndex) {
    const card = document.createElement('div');
    card.className = `swipe-card ${stackIndex === 0 ? 'stack-active' : (stackIndex === 1 ? 'stack-back-1' : 'stack-back-2')}`;
    card.dataset.propId = prop.id;

    // Image carousel setup
    const images = prop.images && prop.images.length > 0 ? prop.images : ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'];
    let currentImgIdx = 0;

    const formattedPrice = '$' + prop.price.toLocaleString();
    const commuteTime = prop.commute_minutes[state.filters.commuteHub] || 15;

    card.innerHTML = `
      <!-- Swipe Stamps -->
      <div class="swipe-stamp like">LIKE</div>
      <div class="swipe-stamp nope">PASS</div>
      <div class="swipe-stamp superlike">SUPERLIKE</div>

      <!-- Top Badges -->
      <div class="card-top-badges">
        <div class="match-score-pill">
          <i class="fa-solid fa-sparkles"></i>
          <span>${prop.match_score || 95}% Vibe Match</span>
        </div>
        <div class="prop-type-pill">${prop.property_type}</div>
      </div>

      <!-- Media & Carousel -->
      <div class="card-media-wrap">
        <img class="card-img" id="img-${prop.id}" src="${images[0]}" alt="${prop.title}">
        <div class="card-media-gradient"></div>

        <div class="carousel-dots">
          ${images.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
        </div>

        <div class="media-tap-prev media-tap-zone" title="Previous photo"></div>
        <div class="media-tap-next media-tap-zone" title="Next photo"></div>
      </div>

      <!-- Card Info -->
      <div class="card-info">
        <div>
          <div class="card-title-row">
            <h3 class="card-title">${prop.title}</h3>
            <span class="card-price">${formattedPrice}</span>
          </div>

          <div class="card-location">
            <i class="fa-solid fa-location-dot"></i>
            <span>${prop.neighborhood}, ${prop.city}</span>
          </div>

          <div class="card-specs-row">
            <div class="spec-item"><i class="fa-solid fa-bed"></i> ${prop.bedrooms} Beds</div>
            <div class="spec-item"><i class="fa-solid fa-bath"></i> ${prop.bathrooms} Baths</div>
            <div class="spec-item"><i class="fa-solid fa-ruler-combined"></i> ${prop.sqft.toLocaleString()} sqft</div>
          </div>

          <div class="card-vibes-row">
            ${prop.vibes.slice(0, 3).map(v => `<span class="vibe-tag">${v}</span>`).join('')}
          </div>
        </div>

        <!-- Lifestyle Radar Mini Bar -->
        <div class="lifestyle-mini-bar">
          <div class="lifestyle-pill" title="Walk Score">
            <i class="fa-solid fa-person-walking" style="color:#38bdf8;"></i>
            <span>Walk <strong>${prop.walk_score}</strong></span>
          </div>
          <div class="lifestyle-pill" title="Green & Parks Score">
            <i class="fa-solid fa-tree" style="color:#34d399;"></i>
            <span>Park <strong>${prop.green_score}</strong></span>
          </div>
          <div class="lifestyle-pill" title="Commute to ${state.filters.commuteHub}">
            <i class="fa-solid fa-car" style="color:#f59e0b;"></i>
            <span><strong>${commuteTime}m</strong> Hub</span>
          </div>
        </div>
      </div>
    `;

    // Handle Image Carousel Taps
    const imgEl = card.querySelector(`#img-${prop.id}`);
    const dots = card.querySelectorAll('.carousel-dot');

    const updateImage = (newIdx) => {
      currentImgIdx = (newIdx + images.length) % images.length;
      imgEl.src = images[currentImgIdx];
      dots.forEach((d, i) => d.classList.toggle('active', i === currentImgIdx));
    };

    card.querySelector('.media-tap-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      updateImage(currentImgIdx - 1);
    });

    card.querySelector('.media-tap-next').addEventListener('click', (e) => {
      e.stopPropagation();
      updateImage(currentImgIdx + 1);
    });

    // Double tap or click on card info opens drawer
    card.querySelector('.card-info').addEventListener('click', (e) => {
      if (!swipeController.hasMovedSignificantly) {
        openPropertyDrawer(prop);
      }
    });

    return card;
  }

  function renderEmptyDeck() {
    cardStackEl.innerHTML = `
      <div class="empty-deck-card">
        <div class="empty-deck-icon"><i class="fa-solid fa-champagne-glasses"></i></div>
        <h3>You've reviewed all homes!</h3>
        <p style="color:var(--text-secondary); margin:0.5rem 0 1.25rem;">
          You've explored all current listings matching your aesthetic. Check out your shortlisted matches or reset the deck to review again.
        </p>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; justify-content:center;">
          <button class="primary-btn" id="btn-view-matches-from-empty">
            <i class="fa-solid fa-heart"></i> View Shortlist (<span id="empty-matches-count">${state.matches.length}</span>)
          </button>
          <button class="secondary-btn" id="btn-reset-swipes-empty">
            <i class="fa-solid fa-rotate-right"></i> Reset Deck
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-view-matches-from-empty')?.addEventListener('click', () => {
      switchTab('matches-tab');
    });
    document.getElementById('btn-reset-swipes-empty')?.addEventListener('click', resetAllSwipes);
  }

  /* -------------------------------------------------------------------
     3. SWIPE ACTIONS & ANIMATION
     ------------------------------------------------------------------- */
  function setupSwipeActions() {
    document.getElementById('btn-pass').addEventListener('click', () => {
      swipeController?.triggerSwipe('pass');
    });

    document.getElementById('btn-like').addEventListener('click', () => {
      swipeController?.triggerSwipe('like');
    });

    document.getElementById('btn-superlike').addEventListener('click', () => {
      swipeController?.triggerSwipe('superlike');
    });

    document.getElementById('btn-undo').addEventListener('click', undoLastSwipe);

    document.getElementById('btn-info').addEventListener('click', () => {
      if (state.activeProp) {
        openPropertyDrawer(state.activeProp);
      }
    });

    document.getElementById('reset-deck-btn').addEventListener('click', resetAllSwipes);
  }

  async function handleSwipeComplete(action, property) {
    // Send to backend
    try {
      await fetch('/api/matches/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: property.id, action: action })
      });
    } catch (e) {
      console.error('Error posting swipe:', e);
    }

    if (action === 'like') {
      showToast(`Shortlisted: ${property.title}`, 'fa-heart');
    } else if (action === 'superlike') {
      showToast(`★ Superliked! ${property.title}`, 'fa-star');
    }

    // Remove from local deck state
    state.deck = state.deck.filter(p => p.id !== property.id);
    await refreshMatchesCount();

    // Re-render deck state
    renderDeck();
  }

  async function undoLastSwipe() {
    try {
      const res = await fetch('/api/matches/undo', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success' && data.restored_property) {
        showToast(`Restored ${data.restored_property.title}`, 'fa-arrow-rotate-left');
        state.deck.unshift(data.restored_property);
        await refreshMatchesCount();
        renderDeck();
      } else {
        showToast('Nothing to undo!', 'fa-circle-info');
      }
    } catch (e) {
      console.error('Error during undo:', e);
    }
  }

  async function resetAllSwipes() {
    if (!confirm('Reset all swipes and start fresh?')) return;
    try {
      await fetch('/api/matches/reset', { method: 'POST' });
      showToast('Deck refreshed!', 'fa-rotate-right');
      state.selectedForCompare.clear();
      updateCompareTray();
      await refreshMatchesCount();
      await loadDeck();
    } catch (e) {
      console.error('Error resetting:', e);
    }
  }

  /* -------------------------------------------------------------------
     4. MATCHES / SHORTLIST
     ------------------------------------------------------------------- */
  async function refreshMatchesCount() {
    try {
      const res = await fetch('/api/matches/');
      const data = await res.json();
      state.matches = data.matches || [];
      const count = state.matches.length;
      matchesBadgeEl.textContent = count;
      const countAll = document.getElementById('count-all');
      if (countAll) countAll.textContent = count;
      const countSuper = document.getElementById('count-superlikes');
      if (countSuper) countSuper.textContent = state.matches.filter(m => m.swipe_action === 'superlike').length;
      const countLikes = document.getElementById('count-likes');
      if (countLikes) countLikes.textContent = state.matches.filter(m => m.swipe_action === 'like').length;
      const emptyCount = document.getElementById('empty-matches-count');
      if (emptyCount) emptyCount.textContent = count;
    } catch (e) {
      console.error('Error refreshing matches:', e);
    }
  }

  async function loadMatches(filterType = 'all') {
    await refreshMatchesCount();

    let filtered = state.matches;
    if (filterType === 'superlike') {
      filtered = state.matches.filter(m => m.swipe_action === 'superlike');
    } else if (filterType === 'like') {
      filtered = state.matches.filter(m => m.swipe_action === 'like');
    }

    // Update filter pills UI
    document.querySelectorAll('.matches-filter-pills .pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filterType);
    });

    if (filtered.length === 0) {
      matchesGridEl.innerHTML = '';
      matchesEmptyEl.style.display = 'flex';
      return;
    }

    matchesEmptyEl.style.display = 'none';
    matchesGridEl.innerHTML = filtered.map(prop => createMatchCardHTML(prop)).join('');

    // Attach event listeners to match cards
    matchesGridEl.querySelectorAll('.match-card').forEach(card => {
      const propId = card.dataset.id;
      const prop = state.matches.find(m => m.id === propId);

      // Compare checkbox
      const chk = card.querySelector('.compare-chk');
      if (chk) {
        chk.checked = state.selectedForCompare.has(propId);
        chk.addEventListener('change', () => {
          if (chk.checked) {
            if (state.selectedForCompare.size >= 4) {
              alert('You can compare a maximum of 4 properties at a time.');
              chk.checked = false;
              return;
            }
            state.selectedForCompare.add(propId);
          } else {
            state.selectedForCompare.delete(propId);
          }
          updateCompareTray();
        });
      }

      // Details button
      card.querySelector('.btn-match-details')?.addEventListener('click', () => {
        openPropertyDrawer(prop);
      });

      // Mortgage calc button
      card.querySelector('.btn-match-calc')?.addEventListener('click', () => {
        populateMortgageCalculator(prop);
        switchTab('calculator-tab');
      });
    });

    updateCompareTray();
  }

  // Filter pills event listeners
  document.querySelectorAll('.matches-filter-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadMatches(btn.dataset.filter);
    });
  });

  function createMatchCardHTML(prop) {
    const isSuper = prop.swipe_action === 'superlike';
    return `
      <div class="match-card" data-id="${prop.id}">
        <div class="match-card-media">
          <img src="${prop.images[0]}" alt="${prop.title}">
          <div class="match-type-stamp ${isSuper ? 'superlike' : 'like'}">
            <i class="fa-solid ${isSuper ? 'fa-star' : 'fa-heart'}"></i>
            <span>${isSuper ? 'Superliked' : 'Shortlisted'}</span>
          </div>
        </div>
        <div class="match-card-body">
          <div class="match-card-header">
            <h4 class="match-card-title">${prop.title}</h4>
            <span class="match-card-price">$${prop.price.toLocaleString()}</span>
          </div>
          <div class="card-location">
            <i class="fa-solid fa-location-dot"></i> ${prop.neighborhood}, ${prop.city}
          </div>
          <div class="card-specs-row" style="margin:0.25rem 0 0.5rem; border:none; padding:0;">
            <div class="spec-item"><i class="fa-solid fa-bed"></i> ${prop.bedrooms}b</div>
            <div class="spec-item"><i class="fa-solid fa-bath"></i> ${prop.bathrooms}ba</div>
            <div class="spec-item"><i class="fa-solid fa-ruler-combined"></i> ${prop.sqft} sqft</div>
            <div class="spec-item" style="color:#34d399;"><i class="fa-solid fa-award"></i> ${prop.match_score || 95}%</div>
          </div>
          <div class="card-vibes-row">
            ${prop.vibes.slice(0, 2).map(v => `<span class="vibe-tag">${v}</span>`).join('')}
          </div>
          <div class="match-card-actions">
            <label class="compare-checkbox-label">
              <input type="checkbox" class="compare-chk">
              <span>Select to compare</span>
            </label>
            <div class="btn-group-sm">
              <button class="icon-btn-sm btn-match-calc" title="Calculate Mortgage">
                <i class="fa-solid fa-calculator"></i>
              </button>
              <button class="icon-btn-sm btn-match-details" title="Full Details">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function updateCompareTray() {
    const count = state.selectedForCompare.size;
    compareBadgeEl.textContent = count;

    if (count > 0 && state.activeTab === 'matches-tab') {
      compareTrayEl.style.display = 'block';
      document.getElementById('compare-tray-text').textContent = `${count} propert${count === 1 ? 'y' : 'ies'} selected for comparison`;
    } else {
      compareTrayEl.style.display = 'none';
    }
  }

  document.getElementById('trigger-compare-btn')?.addEventListener('click', () => {
    switchTab('compare-tab');
  });

  document.getElementById('clear-compare-btn')?.addEventListener('click', () => {
    state.selectedForCompare.clear();
    loadMatches('all');
  });

  /* -------------------------------------------------------------------
     5. COMPARE MATRIX
     ------------------------------------------------------------------- */
  async function renderComparisonView() {
    const emptyEl = document.getElementById('compare-empty');
    const tableContainer = document.getElementById('compare-table-container');

    if (state.selectedForCompare.size < 2) {
      emptyEl.style.display = 'flex';
      tableContainer.innerHTML = '';
      return;
    }

    emptyEl.style.display = 'none';
    const ids = Array.from(state.selectedForCompare).join(',');

    try {
      const res = await fetch(`/api/matches/compare?ids=${ids}`);
      const data = await res.json();
      const props = data.comparison || [];

      if (props.length === 0) {
        emptyEl.style.display = 'flex';
        return;
      }

      tableContainer.innerHTML = `
        <table class="compare-table">
          <thead>
            <tr>
              <th>Property</th>
              ${props.map(p => `
                <td>
                  <div class="compare-prop-card-head">
                    <img class="compare-prop-thumb" src="${p.images[0]}" alt="${p.title}">
                    <strong style="color:#fff; font-size:1.05rem;">${p.title}</strong>
                    <span style="color:#38bdf8; font-weight:800; font-size:1.2rem;">$${p.price.toLocaleString()}</span>
                  </div>
                </td>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Neighborhood & City</th>
              ${props.map(p => `<td>${p.neighborhood}, ${p.city}</td>`).join('')}
            </tr>
            <tr>
              <th>Price / Sq Ft</th>
              ${props.map(p => `<td>$${Math.round(p.price / p.sqft).toLocaleString()} / sqft</td>`).join('')}
            </tr>
            <tr>
              <th>Living Area</th>
              ${props.map(p => `<td>${p.bedrooms} Beds, ${p.bathrooms} Baths (${p.sqft.toLocaleString()} sqft)</td>`).join('')}
            </tr>
            <tr>
              <th>Architectural Style</th>
              ${props.map(p => `<td><span class="vibe-tag" style="background:rgba(6,182,212,0.15); border-color:rgba(6,182,212,0.3); color:#67e8f9;">${p.architectural_style}</span></td>`).join('')}
            </tr>
            <tr>
              <th>Vibe Tags</th>
              ${props.map(p => `<td><div style="display:flex; flex-wrap:wrap; gap:4px;">${p.vibes.map(v => `<span class="vibe-tag">${v}</span>`).join('')}</div></td>`).join('')}
            </tr>
            <tr>
              <th>Walk & Transit Scores</th>
              ${props.map(p => `<td>Walk: <strong>${p.walk_score}</strong> / Transit: <strong>${p.transit_score}</strong></td>`).join('')}
            </tr>
            <tr>
              <th>Commute: Downtown Hub</th>
              ${props.map(p => `<td><strong style="color:#f59e0b;">${p.commute_minutes['Downtown Tech Core'] || 20} mins</strong></td>`).join('')}
            </tr>
            <tr>
              <th>Estimated Monthly P&I</th>
              ${props.map(p => `<td><strong style="color:#34d399;">$${Math.round((p.price * 0.8) * 0.00632).toLocaleString()} / mo</strong> (est.)</td>`).join('')}
            </tr>
            <tr>
              <th>Key Amenities</th>
              ${props.map(p => `<td><ul style="padding-left:16px; font-size:0.8rem; color:#94a3b8;">${p.amenities.slice(0, 4).map(a => `<li>${a}</li>`).join('')}</ul></td>`).join('')}
            </tr>
          </tbody>
        </table>
      `;
    } catch (e) {
      console.error('Error loading comparison:', e);
    }
  }

  /* -------------------------------------------------------------------
     6. MORTGAGE CALCULATOR LAB
     ------------------------------------------------------------------- */
  function setupMortgageLab() {
    const priceSlider = document.getElementById('calc-price-input');
    const downSlider = document.getElementById('calc-down-input');
    const rateSlider = document.getElementById('calc-rate-input');
    const termSelect = document.getElementById('calc-term-input');
    const taxInput = document.getElementById('calc-tax-rate');
    const hoaInput = document.getElementById('calc-hoa-input');
    const insInput = document.getElementById('calc-insurance-input');

    const updateCalc = () => {
      const price = parseFloat(priceSlider.value);
      const downPercent = parseFloat(downSlider.value);
      const rate = parseFloat(rateSlider.value);
      const termYears = parseInt(termSelect.value);
      const taxRate = parseFloat(taxInput.value);
      const hoa = parseFloat(hoaInput.value) || 0;
      const insurance = parseFloat(insInput.value) || 0;

      // Update Slider Label Displays
      document.getElementById('disp-calc-price').textContent = '$' + price.toLocaleString();
      const downAmount = price * (downPercent / 100);
      document.getElementById('disp-calc-down').textContent = `${downPercent}% ($${Math.round(downAmount).toLocaleString()})`;
      document.getElementById('disp-calc-rate').textContent = rate.toFixed(2) + '%';

      // Instant Math
      const loanAmount = price - downAmount;
      const monthlyRate = (rate / 100) / 12;
      const numPayments = termYears * 12;

      let monthlyPI = 0;
      if (monthlyRate > 0) {
        monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
      } else {
        monthlyPI = loanAmount / numPayments;
      }

      const monthlyTax = (price * (taxRate / 100)) / 12;
      const monthlyIns = insurance / 12;
      const totalMonthly = monthlyPI + monthlyTax + monthlyIns + hoa;
      const totalInterest = (monthlyPI * numPayments) - loanAmount;

      // Display Hero
      document.getElementById('total-monthly-amount').innerHTML = `$${Math.round(totalMonthly).toLocaleString()}<span class="mo">/mo</span>`;

      // Breakdown Items
      document.getElementById('val-pi').textContent = '$' + Math.round(monthlyPI).toLocaleString();
      document.getElementById('val-tax').textContent = '$' + Math.round(monthlyTax).toLocaleString();
      document.getElementById('val-ins').textContent = '$' + Math.round(monthlyIns).toLocaleString();
      document.getElementById('val-hoa').textContent = '$' + Math.round(hoa).toLocaleString();

      // Summary Stats
      document.getElementById('val-loan-amt').textContent = '$' + Math.round(loanAmount).toLocaleString();
      document.getElementById('val-down-amt').textContent = '$' + Math.round(downAmount).toLocaleString();
      document.getElementById('val-total-interest').textContent = '$' + Math.round(totalInterest).toLocaleString();

      // Progress Bar Segments
      const piPct = (monthlyPI / totalMonthly) * 100;
      const taxPct = (monthlyTax / totalMonthly) * 100;
      const insPct = (monthlyIns / totalMonthly) * 100;
      const hoaPct = (hoa / totalMonthly) * 100;

      document.getElementById('bar-pi').style.width = piPct + '%';
      document.getElementById('bar-tax').style.width = taxPct + '%';
      document.getElementById('bar-ins').style.width = insPct + '%';
      document.getElementById('bar-hoa').style.width = hoaPct + '%';
    };

    [priceSlider, downSlider, rateSlider, termSelect, taxInput, hoaInput, insInput].forEach(el => {
      el.addEventListener('input', updateCalc);
    });

    // Button to load active card specs
    document.getElementById('load-active-prop-calc')?.addEventListener('click', () => {
      if (state.activeProp) {
        populateMortgageCalculator(state.activeProp);
        showToast(`Loaded ${state.activeProp.title} numbers into lab`, 'fa-wand-magic-sparkles');
      } else if (state.matches.length > 0) {
        populateMortgageCalculator(state.matches[0]);
        showToast(`Loaded ${state.matches[0].title} numbers into lab`, 'fa-wand-magic-sparkles');
      }
    });

    updateCalc();
  }

  function populateMortgageCalculator(prop) {
    const priceSlider = document.getElementById('calc-price-input');
    const hoaInput = document.getElementById('calc-hoa-input');
    if (priceSlider) priceSlider.value = prop.price;
    if (hoaInput) hoaInput.value = prop.hoa_fee || 0;

    // Trigger update
    priceSlider.dispatchEvent(new Event('input'));
  }

  /* -------------------------------------------------------------------
     7. PROPERTY DETAIL DRAWER
     ------------------------------------------------------------------- */
  function openPropertyDrawer(prop) {
    state.activeProp = prop;
    const content = document.getElementById('drawer-content');
    const formattedPrice = '$' + prop.price.toLocaleString();

    content.innerHTML = `
      <div class="drawer-gallery">
        ${prop.images.map(img => `<img src="${img}" alt="${prop.title}">`).join('')}
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <h2 style="font-family:var(--font-display); font-size:1.6rem; color:#fff;">${prop.title}</h2>
          <span style="font-family:var(--font-display); font-size:1.7rem; font-weight:800; color:#38bdf8;">${formattedPrice}</span>
        </div>
        <p style="color:#94a3b8; font-size:0.95rem; margin-top:4px;">
          <i class="fa-solid fa-location-dot" style="color:var(--accent-primary);"></i> ${prop.address}, ${prop.neighborhood}, ${prop.city}, ${prop.state} ${prop.zip_code}
        </p>
      </div>

      <div class="card-specs-row" style="font-size:0.95rem;">
        <div class="spec-item"><i class="fa-solid fa-bed"></i> ${prop.bedrooms} Bedrooms</div>
        <div class="spec-item"><i class="fa-solid fa-bath"></i> ${prop.bathrooms} Bathrooms</div>
        <div class="spec-item"><i class="fa-solid fa-ruler-combined"></i> ${prop.sqft.toLocaleString()} Sq Ft</div>
        <div class="spec-item"><i class="fa-solid fa-calendar-check"></i> Built ${prop.year_built}</div>
      </div>

      <div>
        <h4 style="font-family:var(--font-display); margin-bottom:0.5rem; color:#fff;">Aesthetic & Vibe Tags</h4>
        <div class="card-vibes-row">
          ${prop.vibes.map(v => `<span class="vibe-tag" style="font-size:0.8rem; padding:0.3rem 0.75rem;">${v}</span>`).join('')}
        </div>
      </div>

      <div>
        <h4 style="font-family:var(--font-display); margin-bottom:0.5rem; color:#fff;">The Space</h4>
        <p style="color:#cbd5e1; line-height:1.6; font-size:0.95rem;">${prop.description}</p>
      </div>

      <div>
        <h4 style="font-family:var(--font-display); margin-bottom:0.5rem; color:#fff;">Neighborhood Lifestyle Metrics</h4>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">
          <div class="stat-pill">
            <span class="stat-lbl"><i class="fa-solid fa-person-walking" style="color:#38bdf8;"></i> Walk Score</span>
            <span class="stat-val">${prop.walk_score} / 100</span>
          </div>
          <div class="stat-pill">
            <span class="stat-lbl"><i class="fa-solid fa-train" style="color:#a855f7;"></i> Transit Score</span>
            <span class="stat-val">${prop.transit_score} / 100</span>
          </div>
          <div class="stat-pill">
            <span class="stat-lbl"><i class="fa-solid fa-tree" style="color:#34d399;"></i> Green Score</span>
            <span class="stat-val">${prop.green_score} / 100</span>
          </div>
        </div>
      </div>

      <div>
        <h4 style="font-family:var(--font-display); margin-bottom:0.5rem; color:#fff;">Commute Tolerances</h4>
        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-glass); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px;">
          ${Object.entries(prop.commute_minutes).map(([dest, mins]) => `
            <div style="display:flex; justify-content:space-between; font-size:0.88rem;">
              <span style="color:#94a3b8;">${dest}</span>
              <strong style="color:${mins <= 15 ? '#34d399' : (mins <= 25 ? '#38bdf8' : '#f59e0b')}">${mins} mins</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <h4 style="font-family:var(--font-display); margin-bottom:0.75rem; color:#fff;">Premium Amenities</h4>
        <div class="amenities-grid">
          ${prop.amenities.map(a => `
            <div class="amenity-chip">
              <i class="fa-solid fa-circle-check"></i>
              <span>${a}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('drawer-like-btn').onclick = () => {
      swipeController?.animateFlyOut('like');
      closeDrawer();
    };

    document.getElementById('drawer-calc-btn').onclick = () => {
      closeDrawer();
      populateMortgageCalculator(prop);
      switchTab('calculator-tab');
    };

    propertyDrawerEl.style.display = 'block';
  }

  function closeDrawer() {
    propertyDrawerEl.style.display = 'none';
  }

  document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);
  propertyDrawerEl.addEventListener('click', (e) => {
    if (e.target === propertyDrawerEl) closeDrawer();
  });

  /* -------------------------------------------------------------------
     8. FILTERS & VIBES MODAL
     ------------------------------------------------------------------- */
  async function fetchAllVibes() {
    try {
      const res = await fetch('/api/properties/vibes');
      const data = await res.json();
      state.allVibes = data.vibes || [];
      renderVibeChips();
    } catch (e) {
      console.error('Error fetching vibes:', e);
    }
  }

  function renderVibeChips() {
    const container = document.getElementById('vibe-chips-container');
    if (!container) return;

    container.innerHTML = state.allVibes.map(vibe => `
      <button class="vibe-chip ${state.filters.vibes.includes(vibe) ? 'active' : ''}" data-vibe="${vibe}">
        ${vibe}
      </button>
    `).join('');

    container.querySelectorAll('.vibe-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const vibe = chip.dataset.vibe;
        if (state.filters.vibes.includes(vibe)) {
          state.filters.vibes = state.filters.vibes.filter(v => v !== vibe);
          chip.classList.remove('active');
        } else {
          state.filters.vibes.push(vibe);
          chip.classList.add('active');
        }
      });
    });
  }

  function setupFilters() {
    const filterBtn = document.getElementById('filter-btn');
    const closeBtn = document.getElementById('close-filter-modal');
    const applyBtn = document.getElementById('apply-filter-btn');
    const resetBtn = document.getElementById('reset-filter-btn');
    const maxPriceSlider = document.getElementById('filter-max-price');
    const priceDisplay = document.getElementById('disp-filter-max-price');
    const commuteSelect = document.getElementById('filter-commute-hub');

    filterBtn.addEventListener('click', () => {
      filterModalEl.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => {
      filterModalEl.style.display = 'none';
    });

    maxPriceSlider.addEventListener('input', () => {
      priceDisplay.textContent = '$' + parseInt(maxPriceSlider.value).toLocaleString();
    });

    applyBtn.addEventListener('click', () => {
      state.filters.maxPrice = parseInt(maxPriceSlider.value);
      state.filters.commuteHub = commuteSelect.value;
      filterModalEl.style.display = 'none';

      // Update Active Dot
      const hasActiveFilters = state.filters.vibes.length > 0 || state.filters.maxPrice < 2000000;
      document.getElementById('filter-active-dot').style.display = hasActiveFilters ? 'inline-block' : 'none';

      loadDeck();
      showToast('Filters applied!', 'fa-sliders');
    });

    resetBtn.addEventListener('click', () => {
      state.filters.maxPrice = 2000000;
      state.filters.vibes = [];
      maxPriceSlider.value = 2000000;
      priceDisplay.textContent = '$2,000,000';
      renderVibeChips();
    });
  }

  /* -------------------------------------------------------------------
     9. KEYBOARD SHORTCUTS
     ------------------------------------------------------------------- */
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        swipeController?.triggerSwipe('pass');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        swipeController?.triggerSwipe('like');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        swipeController?.triggerSwipe('superlike');
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        undoLastSwipe();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (propertyDrawerEl.style.display === 'block') {
          closeDrawer();
        } else if (state.activeProp) {
          openPropertyDrawer(state.activeProp);
        }
      } else if (e.key === 'Escape') {
        closeDrawer();
        filterModalEl.style.display = 'none';
      }
    });
  }

  /* -------------------------------------------------------------------
     10. TOAST NOTIFICATIONS
     ------------------------------------------------------------------- */
  function showToast(message, iconClass = 'fa-check') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i><span>${message}</span>`;
    toastContainerEl.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }
});
