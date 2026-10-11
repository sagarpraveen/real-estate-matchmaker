/* =====================================================================
   NestMatch Swipe Physics & Gesture Controller
   Supports Touch & Mouse drag, rotation, flyout animations, and buttons
   ===================================================================== */

class SwipeController {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.onSwipe = options.onSwipe || (() => {});
    this.onCardClick = options.onCardClick || (() => {});
    this.threshold = options.threshold || 110;
    this.verticalThreshold = options.verticalThreshold || 120;
    
    this.activeCard = null;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.hasMovedSignificantly = false;

    this.bindGlobalEvents();
  }

  bindGlobalEvents() {
    window.addEventListener('mousemove', (e) => this.handleMove(e));
    window.addEventListener('mouseup', (e) => this.handleEnd(e));
    window.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.handleEnd(e));
    window.addEventListener('touchcancel', (e) => this.handleEnd(e));
  }

  attachCard(cardElement, propertyData) {
    cardElement.dataset.propId = propertyData.id;
    cardElement.propertyData = propertyData;

    // Attach listeners
    cardElement.addEventListener('mousedown', (e) => this.handleStart(e, cardElement));
    cardElement.addEventListener('touchstart', (e) => this.handleStart(e, cardElement), { passive: true });
  }

  handleStart(e, cardElement) {
    // Only drag top card
    if (!cardElement.classList.contains('stack-active')) return;
    
    // Ignore clicks on buttons or media navigation
    if (e.target.closest('.media-tap-zone') || e.target.closest('button')) {
      return;
    }

    this.activeCard = cardElement;
    this.isDragging = true;
    this.hasMovedSignificantly = false;

    const point = e.touches ? e.touches[0] : e;
    this.startX = point.clientX;
    this.startY = point.clientY;
    this.currentX = this.startX;
    this.currentY = this.startY;

    this.activeCard.style.transition = 'none';
  }

  handleMove(e) {
    if (!this.isDragging || !this.activeCard) return;

    const point = e.touches ? e.touches[0] : e;
    this.currentX = point.clientX;
    this.currentY = point.clientY;

    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;

    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      this.hasMovedSignificantly = true;
      if (e.cancelable && e.touches) {
        e.preventDefault();
      }
    }

    // Dynamic rotation & translation
    const rotateDeg = deltaX * 0.07;
    this.activeCard.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotateDeg}deg)`;

    // Update Stamps Opacity
    this.updateStamps(deltaX, deltaY);
  }

  updateStamps(deltaX, deltaY) {
    if (!this.activeCard) return;
    const likeStamp = this.activeCard.querySelector('.swipe-stamp.like');
    const nopeStamp = this.activeCard.querySelector('.swipe-stamp.nope');
    const superlikeStamp = this.activeCard.querySelector('.swipe-stamp.superlike');

    if (deltaY < -60 && Math.abs(deltaX) < 80) {
      // Superlike priority
      const superlikeRatio = Math.min(Math.abs(deltaY + 60) / 90, 1);
      if (superlikeStamp) superlikeStamp.style.opacity = superlikeRatio;
      if (likeStamp) likeStamp.style.opacity = 0;
      if (nopeStamp) nopeStamp.style.opacity = 0;
    } else {
      if (superlikeStamp) superlikeStamp.style.opacity = 0;
      if (deltaX > 0) {
        const likeRatio = Math.min(deltaX / this.threshold, 1);
        if (likeStamp) likeStamp.style.opacity = likeRatio;
        if (nopeStamp) nopeStamp.style.opacity = 0;
      } else {
        const nopeRatio = Math.min(Math.abs(deltaX) / this.threshold, 1);
        if (nopeStamp) nopeStamp.style.opacity = nopeRatio;
        if (likeStamp) likeStamp.style.opacity = 0;
      }
    }
  }

  handleEnd(e) {
    if (!this.isDragging || !this.activeCard) return;

    this.isDragging = false;
    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;

    // Check if swipe triggered
    if (deltaY < -this.verticalThreshold && Math.abs(deltaX) < 100) {
      this.animateFlyOut('superlike');
    } else if (deltaX > this.threshold) {
      this.animateFlyOut('like');
    } else if (deltaX < -this.threshold) {
      this.animateFlyOut('pass');
    } else {
      // Snap back
      this.activeCard.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      this.activeCard.style.transform = 'translate(0px, 0px) rotate(0deg)';
      this.resetStamps(this.activeCard);
    }

    this.activeCard = null;
  }

  resetStamps(card) {
    const stamps = card.querySelectorAll('.swipe-stamp');
    stamps.forEach(s => {
      s.style.opacity = 0;
    });
  }

  animateFlyOut(action, specificCard = null) {
    const card = specificCard || this.activeCard;
    if (!card) return;

    const propData = card.propertyData;
    card.style.transition = 'transform 0.45s ease-out, opacity 0.45s ease-out';

    const stamp = card.querySelector(`.swipe-stamp.${action === 'pass' ? 'nope' : action}`);
    if (stamp) stamp.style.opacity = 1;

    let targetTransform = '';
    if (action === 'like') {
      targetTransform = 'translate(1000px, 80px) rotate(35deg)';
    } else if (action === 'pass') {
      targetTransform = 'translate(-1000px, 80px) rotate(-35deg)';
    } else if (action === 'superlike') {
      targetTransform = 'translate(0px, -1000px) rotate(0deg)';
    }

    card.style.transform = targetTransform;
    card.style.opacity = '0';

    setTimeout(() => {
      card.remove();
      this.onSwipe(action, propData);
    }, 380);
  }

  triggerSwipe(action) {
    const topCard = this.container.querySelector('.swipe-card.stack-active');
    if (!topCard) return;
    this.animateFlyOut(action, topCard);
  }
}

window.SwipeController = SwipeController;
