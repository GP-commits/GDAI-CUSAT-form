/* ===================================================
   GDAI CUSAT — Form Logic
   Multi-step branching, validation, submission
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recruitment-form');
  const sections = document.querySelectorAll('.form-section');
  const progressFill = document.querySelector('.progress-bar-fill');
  const progressText = document.querySelector('.progress-text');
  const stepLabels = document.querySelectorAll('.progress-step-label');

  // State
  let currentStep = 0;
  const steps = ['basic', 'role-select', 'role-questions', 'final'];
  let selectedRole = null;

  // Role section mapping
  const roleSections = {
    'Vice President': 'section-vp',
    'Technical Lead (Programming)': 'section-tech',
    'Art & Design Lead': 'section-art',
    'Game Design Lead': 'section-gamedesign',
    'Marketing & Social Media Lead': 'section-marketing',
    'Event Coordinator': 'section-event',
    'Outreach & Community Manager': 'section-outreach',
  };

  // =============================================
  // NAVIGATION
  // =============================================

  function showSection(stepIndex) {
    // Hide all sections
    sections.forEach(s => s.classList.remove('active'));

    let targetId;
    if (stepIndex === 0) targetId = 'section-basic';
    else if (stepIndex === 1) targetId = 'section-role-select';
    else if (stepIndex === 2) targetId = selectedRole ? roleSections[selectedRole] : null;
    else if (stepIndex === 3) targetId = 'section-final';

    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) {
        target.classList.add('active');
        // Re-trigger animations
        target.querySelectorAll('.form-group').forEach(g => {
          g.style.animation = 'none';
          g.offsetHeight; // Force reflow
          g.style.animation = '';
        });
      }
    }

    currentStep = stepIndex;
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgress() {
    const totalSteps = steps.length;
    const pct = ((currentStep + 1) / totalSteps) * 100;
    progressFill.style.width = pct + '%';
    progressText.textContent = `Step ${currentStep + 1} of ${totalSteps}`;

    stepLabels.forEach((label, i) => {
      label.classList.remove('active', 'completed');
      if (i < currentStep) label.classList.add('completed');
      else if (i === currentStep) label.classList.add('active');
    });
  }

  // =============================================
  // VALIDATION
  // =============================================

  function validateSection(stepIndex) {
    let sectionEl;
    if (stepIndex === 0) sectionEl = document.getElementById('section-basic');
    else if (stepIndex === 1) sectionEl = document.getElementById('section-role-select');
    else if (stepIndex === 2) sectionEl = document.getElementById(roleSections[selectedRole]);
    else if (stepIndex === 3) sectionEl = document.getElementById('section-final');

    if (!sectionEl) return false;

    let valid = true;

    // Clear previous errors
    sectionEl.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    sectionEl.querySelectorAll('.error-message').forEach(el => el.classList.remove('visible'));

    // Validate required inputs
    sectionEl.querySelectorAll('[data-required="true"]').forEach(container => {
      const input = container.querySelector('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], textarea, select');
      if (input) {
        if (!input.value.trim()) {
          input.classList.add('error');
          const errMsg = container.querySelector('.error-message');
          if (errMsg) errMsg.classList.add('visible');
          valid = false;
        }
      }

      // Radio groups
      const radioGroup = container.querySelector('.radio-group[data-required="true"], .role-grid[data-required="true"]');
      if (radioGroup) {
        const checked = radioGroup.querySelector('input[type="radio"]:checked');
        if (!checked) {
          radioGroup.classList.add('error');
          const errMsg = container.querySelector('.error-message');
          if (errMsg) errMsg.classList.add('visible');
          valid = false;
        }
      }

      // Checkbox groups
      const checkGroup = container.querySelector('.checkbox-group[data-required="true"]');
      if (checkGroup) {
        const checked = checkGroup.querySelectorAll('input[type="checkbox"]:checked');
        if (checked.length === 0) {
          checkGroup.classList.add('error');
          const errMsg = container.querySelector('.error-message');
          if (errMsg) errMsg.classList.add('visible');
          valid = false;
        }
      }

      // Scale
      const scaleOpts = container.querySelector('.scale-options[data-required="true"]');
      if (scaleOpts) {
        const selected = scaleOpts.querySelector('.scale-option.selected');
        if (!selected) {
          scaleOpts.classList.add('error');
          const errMsg = container.querySelector('.error-message');
          if (errMsg) errMsg.classList.add('visible');
          valid = false;
        }
      }
    });

    // Special: validate role selection
    if (stepIndex === 1 && !selectedRole) {
      const grid = sectionEl.querySelector('.role-grid');
      if (grid) grid.classList.add('error');
      const errMsg = sectionEl.querySelector('.error-message');
      if (errMsg) errMsg.classList.add('visible');
      valid = false;
    }

    return valid;
  }

  // URL validation helper
  function isValidURL(str) {
    if (!str) return true; // optional
    try {
      new URL(str);
      return true;
    } catch {
      return str.includes('.') && !str.includes(' ');
    }
  }

  // =============================================
  // EVENT HANDLERS
  // =============================================

  // Next button
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-next')) {
      e.preventDefault();
      if (validateSection(currentStep)) {
        if (currentStep < steps.length - 1) {
          showSection(currentStep + 1);
        }
      }
    }
  });

  // Previous button
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-prev')) {
      e.preventDefault();
      if (currentStep > 0) {
        // If going back from final to role-questions, step = 2
        // If going back from role-questions to role-select, step = 1
        showSection(currentStep - 1);
      }
    }
  });

  // Role selection
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.role-card');
    if (card) {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        selectedRole = radio.value;

        // Update visual state
        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Clear any errors
        const grid = card.closest('.role-grid');
        if (grid) grid.classList.remove('error');
        const errMsg = card.closest('.form-group')?.querySelector('.error-message');
        if (errMsg) errMsg.classList.remove('visible');
      }
    }
  });

  // Radio options
  document.addEventListener('change', (e) => {
    if (e.target.type === 'radio') {
      const group = e.target.closest('.radio-group');
      if (group) {
        group.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
        e.target.closest('.radio-option')?.classList.add('selected');
        group.classList.remove('error');
      }
    }
  });

  // Checkbox options
  document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const option = e.target.closest('.checkbox-option');
      if (option) {
        option.classList.toggle('selected', e.target.checked);
      }
      const group = e.target.closest('.checkbox-group');
      if (group) group.classList.remove('error');
    }
  });

  // Scale options
  document.addEventListener('click', (e) => {
    const scaleOpt = e.target.closest('.scale-option');
    if (scaleOpt) {
      const group = scaleOpt.closest('.scale-options');
      group.querySelectorAll('.scale-option').forEach(o => o.classList.remove('selected'));
      scaleOpt.classList.add('selected');
      group.classList.remove('error');
    }
  });

  // Clear input error on typing
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('form-input') || e.target.classList.contains('form-textarea') || e.target.classList.contains('form-select')) {
      e.target.classList.remove('error');
      const errMsg = e.target.closest('.form-group')?.querySelector('.error-message');
      if (errMsg) errMsg.classList.remove('visible');
    }
  });

  // Button ripple effect
  document.addEventListener('mousemove', (e) => {
    const btn = e.target.closest('.btn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty('--x', ((e.clientX - rect.left) / rect.width * 100) + '%');
      btn.style.setProperty('--y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    }
  });

  // =============================================
  // FORM SUBMISSION
  // =============================================

  async function submitForm() {
    if (!validateSection(currentStep)) return;

    const submitBtn = document.querySelector('.btn-submit');
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;

    // Collect all data
    const data = collectFormData();

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        showSuccessScreen();
      } else if (response.status === 409) {
        showDuplicateScreen();
      } else {
        showError(result.error || 'Something went wrong. Please try again.');
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
      }
    } catch (err) {
      showError('Network error. Please check your connection and try again.');
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
  }

  function collectFormData() {
    const get = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const getRadio = (name) => {
      const el = document.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : '';
    };

    const getCheckboxes = (name) => {
      const checked = document.querySelectorAll(`input[name="${name}"]:checked`);
      return Array.from(checked).map(c => c.value);
    };

    const getScale = (containerId) => {
      const container = document.getElementById(containerId);
      if (!container) return '';
      const selected = container.querySelector('.scale-option.selected');
      return selected ? selected.dataset.value : '';
    };

    // Basic info
    const data = {
      full_name: get('full_name'),
      email: get('email'),
      phone: get('phone'),
      year_of_study: getRadio('year_of_study'),
      branch: get('branch'),
      previous_club_experience: get('previous_club_experience'),
      portfolio_link: get('portfolio_link'),
      role_applied: selectedRole,
      role_answers: {},
      second_role_choice: getRadio('second_role_choice'),
      anything_else: get('anything_else'),
      available_for_interview: getRadio('available_for_interview'),
    };

    // Role-specific answers
    switch (selectedRole) {
      case 'Vice President':
        data.role_answers = {
          coordination_view: get('vp_coordination'),
          multitasking_experience: get('vp_multitask'),
          step_in_as_lead: getRadio('vp_stepin'),
          weekly_hours: getRadio('vp_hours'),
        };
        break;
      case 'Technical Lead (Programming)':
        data.role_answers = {
          engines_languages: getCheckboxes('tech_engines'),
          project_link: get('tech_project_link'),
          workshop_plan: get('tech_workshop'),
          mentoring_comfort: getScale('tech_mentoring_scale'),
          weekly_hours: getRadio('tech_hours'),
        };
        break;
      case 'Art & Design Lead':
        data.role_answers = {
          tools: getCheckboxes('art_tools'),
          portfolio: get('art_portfolio'),
          art_styles: get('art_styles'),
          visual_consistency: get('art_consistency'),
          weekly_hours: getRadio('art_hours'),
        };
        break;
      case 'Game Design Lead':
        data.role_answers = {
          admired_game: get('gd_admired_game'),
          design_experience: get('gd_design_exp'),
          playtest_process: get('gd_playtest'),
          weekly_hours: getRadio('gd_hours'),
        };
        break;
      case 'Marketing & Social Media Lead':
        data.role_answers = {
          campaign_links: get('mkt_campaigns'),
          platforms: getCheckboxes('mkt_platforms'),
          caption_pitch: get('mkt_caption'),
          design_tools_comfort: getRadio('mkt_design_tools'),
          weekly_hours: getRadio('mkt_hours'),
        };
        break;
      case 'Event Coordinator':
        data.role_answers = {
          event_experience: get('evt_experience'),
          logistics_problem: get('evt_logistics'),
          admin_coordination: getRadio('evt_admin'),
          weekly_hours: getRadio('evt_hours'),
        };
        break;
      case 'Outreach & Community Manager':
        data.role_answers = {
          community_experience: getRadio('out_community_exp'),
          welcoming_plan: get('out_welcome'),
          existing_contacts: get('out_contacts'),
          weekly_hours: getRadio('out_hours'),
        };
        break;
    }

    return data;
  }

  function showSuccessScreen() {
    document.querySelector('.form-card').style.display = 'none';
    document.querySelector('.progress-container').style.display = 'none';
    document.querySelector('.success-screen').classList.add('active');
  }

  function showDuplicateScreen() {
    document.querySelector('.form-card').style.display = 'none';
    document.querySelector('.progress-container').style.display = 'none';
    document.querySelector('.duplicate-screen').classList.add('active');
  }

  function showError(message) {
    // Create a toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-error';
    toast.innerHTML = `<span>⚠️</span> ${message}`;
    toast.style.cssText = `
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5; padding: 0.8rem 1.5rem; border-radius: 12px;
      font-size: 0.88rem; z-index: 1000; backdrop-filter: blur(10px);
      animation: fadeInDown 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Submit button handler
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-submit')) {
      e.preventDefault();
      submitForm();
    }
  });

  // =============================================
  // INITIALIZE
  // =============================================
  showSection(0);
});
