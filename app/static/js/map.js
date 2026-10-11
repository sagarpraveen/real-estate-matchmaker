/* =====================================================================
   NestMatch Geographic Map Radar
   Powered by Leaflet with dark cyber-aesthetic tiles & live property sync
   ===================================================================== */

class MapRadar {
  constructor(mapElementId) {
    this.mapId = mapElementId;
    this.map = null;
    this.markersLayer = null;
    this.initialized = false;
    this.properties = [];
    this.selectedPropertyId = null;
  }

  init() {
    if (this.initialized) return;
    const el = document.getElementById(this.mapId);
    if (!el) return;

    // Centered initially over North America / US
    this.map = L.map(this.mapId, {
      zoomControl: false,
      attributionControl: false
    }).setView([39.8283, -98.5795], 4);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Free public OpenStreetMap tile layer (No API key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.initialized = true;

    // Invalidate size once tab switches
    setTimeout(() => {
      this.map.invalidateSize();
    }, 250);
  }

  setProperties(props) {
    this.properties = props;
    if (!this.initialized) {
      this.init();
    }
    this.renderMarkers();
    this.renderSidebarList();
  }

  renderMarkers() {
    if (!this.markersLayer) return;
    this.markersLayer.clearLayers();

    if (!this.properties || this.properties.length === 0) return;

    const latLngs = [];

    this.properties.forEach(prop => {
      if (!prop.lat || !prop.lng) return;

      const formattedPrice = '$' + (prop.price >= 1000000 
        ? (prop.price / 1000000).toFixed(1) + 'M' 
        : Math.round(prop.price / 1000) + 'k');

      const customIcon = L.divIcon({
        className: 'custom-map-marker-wrap',
        html: `<div class="custom-map-pin" id="pin-${prop.id}">${formattedPrice}</div>`,
        iconSize: [60, 26],
        iconAnchor: [30, 13]
      });

      const marker = L.marker([prop.lat, prop.lng], { icon: customIcon });

      const popupHtml = `
        <div style="width: 200px; padding: 4px;">
          <img src="${prop.images[0]}" style="width:100%; height:100px; object-fit:cover; border-radius:8px; margin-bottom:6px;" alt="${prop.title}">
          <div style="font-weight:700; font-size:0.85rem; color:#fff; line-height:1.2;">${prop.title}</div>
          <div style="font-size:0.75rem; color:#94a3b8; margin:2px 0 6px;">${prop.neighborhood}, ${prop.city}</div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:800; color:#38bdf8; font-size:0.95rem;">$${prop.price.toLocaleString()}</span>
            <span style="font-size:0.7rem; color:#34d399; font-weight:700;">★ ${prop.match_score || 95}% Match</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        this.highlightProperty(prop.id);
      });

      this.markersLayer.addLayer(marker);
      latLngs.push([prop.lat, prop.lng]);
    });

    if (latLngs.length > 0) {
      this.map.fitBounds(latLngs, { padding: [50, 50], maxZoom: 14 });
    }
  }

  renderSidebarList() {
    const listEl = document.getElementById('map-property-list');
    if (!listEl) return;

    if (!this.properties || this.properties.length === 0) {
      listEl.innerHTML = '<div style="padding:1.5rem; text-align:center; color:#64748b; font-size:0.85rem;">No properties to display</div>';
      return;
    }

    listEl.innerHTML = this.properties.map(p => `
      <div class="map-mini-card ${this.selectedPropertyId === p.id ? 'active' : ''}" data-id="${p.id}">
        <img class="map-mini-thumb" src="${p.images[0]}" alt="${p.title}">
        <div class="map-mini-info">
          <div class="map-mini-title">${p.title}</div>
          <div class="map-mini-price">$${p.price.toLocaleString()}</div>
          <div class="map-mini-meta">${p.bedrooms}b/${p.bathrooms}ba • ${p.neighborhood}</div>
        </div>
      </div>
    `).join('');

    // Attach click listeners to mini cards
    listEl.querySelectorAll('.map-mini-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.focusProperty(id);
      });
    });
  }

  focusProperty(propId) {
    const prop = this.properties.find(p => p.id === propId);
    if (!prop || !this.map) return;

    this.selectedPropertyId = propId;
    this.map.flyTo([prop.lat, prop.lng], 13, { duration: 1.2 });
    this.highlightProperty(propId);
  }

  highlightProperty(propId) {
    this.selectedPropertyId = propId;
    const cards = document.querySelectorAll('.map-mini-card');
    cards.forEach(c => {
      if (c.dataset.id === propId) {
        c.classList.add('active');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        c.classList.remove('active');
      }
    });
  }
}

window.MapRadar = MapRadar;
