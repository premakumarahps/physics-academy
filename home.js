/* ═══════════════════════════════════════════════════════════════
   AL Physics Academy — Service Page Renderer
   Fetches content JSON from server, renders sections dynamically
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── SVG Icon Library ─── */
  const ICONS = {
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    mapPin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 1 1-2.882 0 1.441 1.441 0 0 1 2.882 0z"/></svg>'
  };

  /* ─── Lightweight Markdown Parser ─── */
  function renderMarkdown(text) {
    if (!text) return '';
    // Escape HTML
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Bold **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Split into paragraphs/blocks
    const blocks = html.split(/\n\n+/);
    let result = '';
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      // Check for bullet list
      const lines = trimmed.split('\n');
      const isList = lines.every(l => l.trim().startsWith('- '));
      if (isList) {
        result += '<ul>' + lines.map(l => '<li>' + l.trim().slice(2) + '</li>').join('') + '</ul>';
      } else {
        // Regular paragraph with line breaks
        result += '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
      }
    }
    return result;
  }

  /* ─── Section Renderers ─── */
  function renderHero(section) {
    // Extract the static prefix and rotating phrases from heading
    // heading format: "Master **A/L Physics**\nwith Confidence"
    // We'll use "Master" as static, and rotate through multiple phrases
    return `
    <section class="hero" id="hero">
      <canvas id="physics-canvas"></canvas>
      <div class="hero-overlay"></div>
      
      <div style="flex-grow: 1;"></div>
      
      <div class="hero-content">
        <h1 class="reveal">Master<span class="typewriter-line"><span class="typewriter-text" id="typewriter-text"></span><span class="typewriter-cursor"></span></span></h1>
        <p class="hero-sub reveal">${section.subheading || ''}</p>
        <div class="hero-ctas reveal">
          ${section.ctaText ? `<a href="${section.ctaUrl || '#'}" class="btn btn-primary">${section.ctaText}</a>` : ''}
          ${section.secondaryCtaText ? `<a href="${section.secondaryCtaUrl || '#'}" class="btn btn-outline">${section.secondaryCtaText}</a>` : ''}
        </div>
      </div>
      
      <div class="hero-badge-wrapper" style="flex-grow: 1; display: flex; align-items: flex-end; padding-bottom: 40px; z-index: 10;">
        <div class="hero-badge reveal" id="hero-badge-bottom">
          <span class="dot"></span>
          📢 Enrolling for 2026/2027 A/L Batch ✨
        </div>
      </div>
    </section>`;
  }

  function renderAbout(section) {
    const statsHtml = (section.stats || []).map((s, i) =>
      `<div class="stat-card reveal reveal-delay-${i + 1}">
        <div class="stat-value" data-count="${parseInt(s.value)}">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`
    ).join('');

    return `
    <section class="about" id="about">
      <div class="container">
        <div class="about-grid">
          <div class="about-image reveal">
            <div class="accent-border"></div>
            <img src="${section.image || ''}" alt="About" loading="lazy">
          </div>
          <div class="about-text">
            <h2 class="section-heading reveal">${section.heading || ''}</h2>
            <div class="about-content reveal">
              ${renderMarkdown(section.content)}
            </div>
            <div class="stats-row">${statsHtml}</div>
          </div>
        </div>
      </div>
    </section>`;
  }

  function renderServices(section) {
    const cardsHtml = (section.items || []).map((item, i) =>
      `<div class="service-card reveal reveal-delay-${(i % 3) + 1}">
        <div class="service-icon">${ICONS[item.icon] || ICONS.book}</div>
        <h3>${item.title || ''}</h3>
        <p>${renderMarkdown(item.description).replace(/<\/?p>/g, '')}</p>
      </div>`
    ).join('');

    return `
    <section class="services" id="services">
      <div class="container">
        <h2 class="section-heading reveal">${section.heading || ''}</h2>
        ${section.subheading ? `<p class="section-subheading reveal">${section.subheading}</p>` : ''}
        <div class="services-grid">${cardsHtml}</div>
      </div>
    </section>`;
  }

  function renderGallery(section) {
    const imagesHtml = (section.images || []).map((img, i) =>
      `<div class="gallery-item reveal reveal-delay-${(i % 3) + 1}" data-gallery-index="${i}">
        <img src="${img.src}" alt="${img.caption || ''}" loading="lazy">
        <div class="gallery-caption">${img.caption || ''}</div>
      </div>`
    ).join('');

    return `
    <section class="gallery" id="gallery">
      <div class="container">
        <h2 class="section-heading reveal">${section.heading || ''}</h2>
        ${section.subheading ? `<p class="section-subheading reveal">${section.subheading}</p>` : ''}
        <div class="gallery-grid">${imagesHtml}</div>
      </div>
    </section>`;
  }

  function renderTestimonials(section) {
    const cardsHtml = (section.items || []).map(t => {
      const initials = (t.author || 'U').split(' ').map(w => w[0]).join('').slice(0, 2);
      return `
      <div class="testimonial-card">
        <div class="quote-icon">"</div>
        <blockquote>${t.quote || ''}</blockquote>
        <div class="testimonial-author">
          <div class="testimonial-avatar">${initials}</div>
          <div class="testimonial-info">
            <h4>${t.author || ''}</h4>
            <span>${t.detail || ''}</span>
          </div>
        </div>
      </div>`;
    }).join('');

    const dotsHtml = (section.items || []).map((_, i) =>
      `<button class="dot ${i === 0 ? 'active' : ''}" data-slide="${i}"></button>`
    ).join('');

    return `
    <section class="testimonials" id="testimonials">
      <div class="container">
        <h2 class="section-heading reveal">${section.heading || ''}</h2>
        ${section.subheading ? `<p class="section-subheading reveal">${section.subheading}</p>` : ''}
        <div class="testimonials-track reveal" id="testimonials-track">${cardsHtml}</div>
        <div class="testimonials-dots" id="testimonials-dots">${dotsHtml}</div>
      </div>
    </section>`;
  }

  function renderContact(section) {
    const items = [];
    if (section.phone) items.push({ icon: 'phone', label: 'Phone', value: section.phone, href: `tel:${section.phone.replace(/\s/g, '')}` });
    if (section.whatsapp) items.push({ icon: 'whatsapp', label: 'WhatsApp', value: section.whatsapp, href: `https://wa.me/${section.whatsapp.replace(/[^0-9]/g, '')}` });
    if (section.email) items.push({ icon: 'mail', label: 'Email', value: section.email, href: `mailto:${section.email}` });
    if (section.address) items.push({ icon: 'mapPin', label: 'Location', value: section.address });

    const itemsHtml = items.map((item, i) =>
      `<div class="contact-item reveal reveal-delay-${i + 1}">
        <div class="contact-item-icon">${ICONS[item.icon] || ''}</div>
        <div class="contact-item-text">
          <h4>${item.label}</h4>
          ${item.href ? `<p><a href="${item.href}" target="_blank">${item.value}</a></p>` : `<p>${item.value}</p>`}
        </div>
      </div>`
    ).join('');

    const waNum = (section.whatsapp || '').replace(/[^0-9]/g, '');

    return `
    <section class="contact" id="contact">
      <div class="container">
        <h2 class="section-heading reveal">${section.heading || ''}</h2>
        ${section.subheading ? `<p class="section-subheading reveal">${section.subheading}</p>` : ''}
        <div class="contact-grid">
          <div class="contact-info">
            <div class="contact-content reveal">${renderMarkdown(section.content)}</div>
            <div class="contact-items">${itemsHtml}</div>
          </div>
          <div class="contact-cta-area reveal">
            <div class="contact-card">
              <h3>Ready to Start?</h3>
              <p>Send a WhatsApp message and let's discuss the best plan for your A/L journey.</p>
              <a href="https://wa.me/${waNum}?text=Hi!%20I'm%20interested%20in%20A/L%20Physics%20classes." class="btn btn-whatsapp" target="_blank">
                ${ICONS.whatsapp}
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>`;
  }

  const SECTION_RENDERERS = {
    hero: renderHero,
    about: renderAbout,
    services: renderServices,
    gallery: renderGallery,
    testimonials: renderTestimonials,
    contact: renderContact
  };

  /* ─── Build Navigation ─── */
  function buildNav(config) {
    const navLinks = document.getElementById('nav-links');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!navLinks || !mobileMenu) return;

    const links = (config.navLinks || []).map(l => `<a href="${l.href}">${l.label}</a>`).join('');
    navLinks.innerHTML = links;

    const mobileLinks = (config.navLinks || [
      { label: 'Home', href: '#hero' },
      { label: 'About', href: '#about' },
      { label: 'Services', href: '#services' },
      { label: 'Gallery', href: '#gallery' },
      { label: 'Testimonials', href: '#testimonials' },
      { label: 'Contact', href: '#contact' }
    ]).map(l => `<a href="${l.href}">${l.label}</a>`).join('');
    
    mobileMenu.innerHTML = mobileLinks + `<a href="${config.lmsButtonUrl || '/login.html'}" class="nav-cta" style="margin-top:16px">${ICONS.clipboard} ${config.lmsButtonText || 'Student Portal'}</a>`;

    // Update logo text
    const logoSpan = document.querySelector('.nav-logo span');
    if (logoSpan && config.siteName) {
      const parts = config.siteName.split(' ');
      if (parts.length > 1) {
        const last = parts.pop();
        logoSpan.innerHTML = parts.join(' ') + ' <span class="logo-accent">' + last + '</span>';
      } else {
        logoSpan.textContent = config.siteName;
      }
    }

    // Update CTA (Desktop)
    const navCta = document.getElementById('nav-cta');
    if (navCta) {
      navCta.href = config.lmsButtonUrl || '/login.html';
      navCta.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> ${config.lmsButtonText || 'Student Portal'}`;
    }

    // Update CTA (Mobile)
    const navCtaMobile = document.getElementById('nav-cta-mobile');
    if (navCtaMobile) {
      navCtaMobile.href = config.lmsButtonUrl || '/login.html';
    }

    // Update page title
    document.title = `${config.siteName || 'AL Physics Academy'} — ${config.tagline || ''}`;
  }

  /* ─── Build Footer ─── */
  function buildFooter(config) {
    const grid = document.getElementById('footer-grid');
    const bottom = document.getElementById('footer-bottom');

    const socialLinks = config.socials || {};
    const socialsHtml = Object.entries(socialLinks).map(([key, url]) => {
      if (!url || !ICONS[key]) return '';
      return `<a href="${url}" target="_blank" aria-label="${key}">${ICONS[key]}</a>`;
    }).join('');

    const navLinksHtml = (config.navLinks || []).map(l => `<a href="${l.href}">${l.label}</a>`).join('');

    grid.innerHTML = `
      <div class="footer-brand">
        <a href="#hero" class="nav-logo">
          <img src="/logo.svg" alt="Logo" style="width:32px;height:32px">
          <span>${config.siteName || 'AL Physics Academy'}</span>
        </a>
        <p style="margin-top:12px">${config.tagline || ''}</p>
      </div>
      <div class="footer-links">
        <h4>Quick Links</h4>
        ${navLinksHtml}
        <a href="${config.lmsButtonUrl || '/login.html'}">Student Portal</a>
      </div>
      <div class="footer-social">
        <h4>Follow Us</h4>
        <div class="footer-socials">${socialsHtml}</div>
        ${config.phone ? `<p style="margin-top:20px;color:var(--text-secondary);font-size:0.9rem">${ICONS.phone ? '' : ''}📞 ${config.phone}</p>` : ''}
      </div>
    `;

    bottom.textContent = config.footerText || `© ${new Date().getFullYear()} AL Physics Academy. All rights reserved.`;
  }

  /* ─── Scroll Animations ─── */
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  /* ─── Sticky Navbar ─── */
  function initNavbar() {
    const navbar = document.getElementById('navbar');
    const toggle = document.getElementById('nav-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
      
      const badge = document.getElementById('hero-badge-bottom');
      if (badge) {
        const op = Math.max(0, 1 - window.scrollY / 250);
        badge.style.opacity = op;
        badge.style.pointerEvents = op < 0.1 ? 'none' : 'auto';
      }
    });

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    // Close mobile menu on link click
    mobileMenu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        toggle.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  /* ─── Gallery Lightbox ─── */
  let galleryImages = [];
  let currentLightboxIndex = 0;

  function initGallery(sections) {
    const gallerySection = sections.find(s => s.type === 'gallery');
    if (!gallerySection) return;
    galleryImages = gallerySection.images || [];

    document.addEventListener('click', (e) => {
      const item = e.target.closest('[data-gallery-index]');
      if (item) {
        currentLightboxIndex = parseInt(item.dataset.galleryIndex);
        openLightbox();
      }
    });

    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    prevBtn.addEventListener('click', () => navigateLightbox(-1));
    nextBtn.addEventListener('click', () => navigateLightbox(1));

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    });
  }

  function openLightbox() {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    const item = galleryImages[currentLightboxIndex];
    if (!item) return;
    img.src = item.src;
    img.alt = item.caption || '';
    caption.textContent = item.caption || '';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
  }

  function navigateLightbox(dir) {
    currentLightboxIndex = (currentLightboxIndex + dir + galleryImages.length) % galleryImages.length;
    openLightbox();
  }

  /* ─── Testimonials Carousel ─── */
  function initTestimonials() {
    const track = document.getElementById('testimonials-track');
    const dotsContainer = document.getElementById('testimonials-dots');
    if (!track || !dotsContainer) return;

    const dots = dotsContainer.querySelectorAll('.dot');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.slide);
        const cards = track.querySelectorAll('.testimonial-card');
        if (cards[idx]) {
          cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      });
    });

    // Update dots on scroll
    track.addEventListener('scroll', () => {
      const scrollLeft = track.scrollLeft;
      const cardWidth = track.querySelector('.testimonial-card')?.offsetWidth || 400;
      const gap = 24;
      const activeIdx = Math.round(scrollLeft / (cardWidth + gap));
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
    });
  }

  /* ─── Typewriter Effect (Human-like) ─── */
  function initTypewriter() {
    const el = document.getElementById('typewriter-text');
    if (!el) return;

    const phrases = [
      'A/L Physics',
      'with Confidence',
      'Your Future',
      'Exam Success',
      'with Expert Guidance'
    ];

    let phraseIdx = 0;
    let charIdx = 0;
    let isDeleting = false;

    // Human-like random delay helpers
    function rand(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getTypeDelay(char, nextChar) {
      // Base keystroke: 90–170ms (humans average ~120ms)
      let delay = rand(90, 170);

      // After a space — brief "thinking" pause (like choosing the next word)
      if (char === ' ') {
        delay += rand(200, 500);
      }

      // Occasional mid-word hesitation (~15% chance) — "thinking while typing"
      if (char !== ' ' && Math.random() < 0.15) {
        delay += rand(150, 400);
      }

      // Slightly slower on capital letters (reaching for shift)
      if (char && char === char.toUpperCase() && char !== char.toLowerCase()) {
        delay += rand(30, 80);
      }

      // Slight burst speed on short common sequences
      if (nextChar && 'aeiou'.includes(nextChar.toLowerCase())) {
        delay -= rand(10, 30);
      }

      return Math.max(60, delay);
    }

    function getDeleteDelay(remaining) {
      // Start slow, accelerate as more chars deleted (human behavior)
      // First few chars: 80-120ms, then accelerate to 30-50ms
      if (remaining > 8) return rand(30, 50);
      if (remaining > 4) return rand(50, 80);
      return rand(70, 120);
    }

    function tick() {
      const current = phrases[phraseIdx];

      if (!isDeleting) {
        // ── Typing Phase ──
        charIdx++;
        el.textContent = current.slice(0, charIdx);

        if (charIdx === current.length) {
          // Finished typing — hold the complete phrase for a natural reading pause
          isDeleting = true;
          const holdTime = rand(2200, 3500); // vary how long we admire the phrase
          setTimeout(tick, holdTime);
          return;
        }

        const typedChar = current[charIdx - 1];
        const nextChar = current[charIdx] || '';
        setTimeout(tick, getTypeDelay(typedChar, nextChar));

      } else {
        // ── Deleting Phase ──
        charIdx--;
        el.textContent = current.slice(0, charIdx);

        if (charIdx === 0) {
          // Finished deleting — pause to "think" of next phrase
          isDeleting = false;
          phraseIdx = (phraseIdx + 1) % phrases.length;
          setTimeout(tick, rand(600, 1200));
          return;
        }

        setTimeout(tick, getDeleteDelay(charIdx));
      }
    }

    // Initial delay — let the page settle, then start naturally
    setTimeout(tick, 1200);
  }

  /* ─── Physics Canvas Animation ─── */
  function initPhysicsCanvas() {
    const canvas = document.getElementById('physics-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height;
    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    let time = 0;
    let patternTime = 0;
    let currentPattern = 0;

    const fov = 800; // 3D Field of View

    // Arrays to maintain a crisp historical trail rather than unreliable alpha smearing
    const p1History = [];
    const p2History = [];
    const maxHistory = 100;

    // The two physics "pens" with Z coordinate
    let p1 = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, color: '#4f46e5' }; // Indigo
    let p2 = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, color: '#d97706' }; // Amber

    let mouseX = width / 2;
    let mouseY = height / 2;
    let isHovering = false;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      isHovering = true;
    });

    const patterns = [
      // 1. 3D Rutherford Atom (Rotating Orbits)
      (t) => {
        const radius1 = Math.min(width * 0.3, 300);
        const radius2 = Math.min(height * 0.3, 300);
        return {
          t1: { x: Math.cos(t*2)*radius1, y: Math.sin(t*1)*80, z: Math.sin(t*2)*radius1 },
          t2: { x: Math.cos(t*2.5 + Math.PI/2)*80, y: Math.sin(t*2.5 + Math.PI/2)*radius2, z: Math.cos(t*2.5)*radius2 }
        };
      },
      // 2. 3D Standing Wave Helix (Tunnel effect)
      (t) => {
        let extent = Math.min(width * 0.4, 400);
        let xOff = (t * 200) % (extent * 2) - extent;
        let xOff2 = ((t + Math.PI) * 200) % (extent * 2) - extent;
        return {
          t1: { x: xOff, y: Math.sin(xOff * 0.01 + t)*150, z: Math.cos(xOff * 0.01 + t)*150 },
          t2: { x: -xOff2, y: Math.cos(xOff2 * 0.01 + t)*150, z: Math.sin(xOff2 * 0.01 + t)*150 }
        };
      },
      // 3. 3D Lorenz-style Chaos Attractor
      (t) => {
        const scale = Math.min(width, height) * 0.4;
        return {
          t1: { x: Math.sin(t*1.5)*Math.cos(t*2.2)*scale, y: Math.cos(t*1.8)*Math.sin(t*2.9)*scale, z: Math.sin(t*2.4)*scale },
          t2: { x: Math.cos(t*1.9)*Math.sin(t*2.5)*scale, y: Math.sin(t*1.6)*Math.cos(t*2.1)*scale, z: Math.cos(t*2.7)*scale }
        };
      }
    ];

    function project(x, y, z) {
      const zAdj = Math.max(-fov + 10, z); // Prevent camera clipping inversion
      const scale = fov / (fov + zAdj);
      return { px: width/2 + x*scale, py: height/2 + y*scale, scale: scale };
    }

    function draw() {
      // 1. HARD CLEAR every frame - ZERO MUD, ZERO SPLASHES
      ctx.clearRect(0, 0, width, height);

      time += 0.012;
      patternTime += 0.012;

      // Switch patterns every 10 seconds
      if (patternTime > 10) {
        currentPattern = (currentPattern + 1) % patterns.length;
        patternTime = 0;
      }

      let target = patterns[currentPattern](time);
      p1.tx = target.t1.x; p1.ty = target.t1.y; p1.tz = target.t1.z;
      p2.tx = target.t2.x; p2.ty = target.t2.y; p2.tz = target.t2.z;

      // Mouse repulsive gravity on 2D projected plane mapped to 3D targets
      if (isHovering) {
        let cx = mouseX - width/2;
        let cy = mouseY - height/2;
        
        let dx1 = cx - p1.tx; let dy1 = cy - p1.ty;
        let dist1 = Math.sqrt(dx1*dx1 + dy1*dy1);
        if (dist1 < 300) { p1.tx -= (dx1/dist1)*30; p1.ty -= (dy1/dist1)*30; }

        let dx2 = cx - p2.tx; let dy2 = cy - p2.ty;
        let dist2 = Math.sqrt(dx2*dx2 + dy2*dy2);
        if (dist2 < 300) { p2.tx -= (dx2/dist2)*30; p2.ty -= (dy2/dist2)*30; }
      }

      // Physics interpolation (spring effect) towards 3D targets
      p1.x += (p1.tx - p1.x) * 0.08; p1.y += (p1.ty - p1.y) * 0.08; p1.z += (p1.tz - p1.z) * 0.08;
      p2.x += (p2.tx - p2.x) * 0.08; p2.y += (p2.ty - p2.y) * 0.08; p2.z += (p2.tz - p2.z) * 0.08;

      const proj1 = project(p1.x, p1.y, p1.z);
      const proj2 = project(p2.x, p2.y, p2.z);

      p1History.push({ px: proj1.px, py: proj1.py, scale: proj1.scale });
      if (p1History.length > maxHistory) p1History.shift();

      p2History.push({ px: proj2.px, py: proj2.py, scale: proj2.scale });
      if (p2History.length > maxHistory) p2History.shift();

      ctx.globalCompositeOperation = 'multiply';

      // Explicit segment rendering: flawless ink rendering without fade compounding
      const drawSegmentTrail = (history, r, g, b) => {
        if (history.length < 2) return;
        for (let i = 1; i < history.length; i++) {
          const ptA = history[i - 1];
          const ptB = history[i];
          const rawAlpha = i / history.length;
          // De-emphasize / fade out objects far away (scale < 1)
          const zDepthFade = Math.min(1, Math.max(0.05, ptB.scale)); 
          const opacity = rawAlpha * zDepthFade * 0.7; // Max opacity 70%

          ctx.beginPath();
          ctx.moveTo(ptA.px, ptA.py);
          ctx.lineTo(ptB.px, ptB.py);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          ctx.lineWidth = 3 * ptB.scale; // Thicker when flying into camera
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      };

      drawSegmentTrail(p1History, 79, 70, 229); // Indigo
      drawSegmentTrail(p2History, 217, 119, 6); // Amber

      // Draw crisp ink heads
      const drawHeadDot = (proj, r, g, b) => {
        ctx.beginPath();
        ctx.arc(proj.px, proj.py, 4 * proj.scale, 0, Math.PI * 2);
        const zDepthFade = Math.min(1, Math.max(0.1, proj.scale));
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${zDepthFade})`;
        ctx.shadowBlur = 10 * proj.scale;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${zDepthFade})`;
        ctx.fill();
        ctx.shadowBlur = 0; 
      };

      drawHeadDot(proj1, 79, 70, 229);
      drawHeadDot(proj2, 217, 119, 6);

      // Draw an energy bond strictly when they are close in 3D
      let dist3D = Math.sqrt(Math.pow(p2.x-p1.x,2) + Math.pow(p2.y-p1.y,2) + Math.pow(p2.z-p1.z,2));
      
      if (dist3D < 300) {
        ctx.beginPath();
        ctx.moveTo(proj1.px, proj1.py);
        ctx.lineTo(proj2.px, proj2.py);
        let opacity = (1 - (dist3D / 300)) * 0.5;
        let avgScale = (proj1.scale + proj2.scale) / 2;
        opacity *= Math.min(1, Math.max(0.1, avgScale)); // Fade out if far away
        
        ctx.strokeStyle = `rgba(15, 23, 42, ${opacity})`;
        ctx.lineWidth = 2 * avgScale;
        ctx.stroke();
      }

      requestAnimationFrame(draw);
    }
    
    // Start animation loop
    draw();
  }

  /* ─── Main Init ─── */
  async function init() {
    try {
      const [configRes, sectionsRes] = await Promise.all([
        fetch('/api/site-content/config'),
        fetch('/api/site-content/sections')
      ]);

      const config = await configRes.json();
      const sections = await sectionsRes.json();

      // Build nav and footer
      buildNav(config);
      buildFooter(config);

      // Render sections
      const main = document.getElementById('main-content');
      let html = '';
      for (const section of sections) {
        const renderer = SECTION_RENDERERS[section.type];
        if (renderer) {
          html += renderer(section);
        }
      }
      main.innerHTML = html;

      // Initialize interactions
      initNavbar();
      initScrollAnimations();
      initGallery(sections);
      initTestimonials();
      initTypewriter();
      initPhysicsCanvas();

    } catch (err) {
      console.error('Failed to load site content:', err);
      document.getElementById('main-content').innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px;">
          <div>
            <h1 style="font-size:2rem;margin-bottom:16px;">Unable to load page</h1>
            <p style="color:var(--text-secondary);">Please check if the server is running and try again.</p>
          </div>
        </div>`;
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
