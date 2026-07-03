/* ===================================================
   GDAI CUSAT — Admin Dashboard Logic
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const listContainer = document.getElementById('submissions-list');
  const listCountBadge = document.getElementById('list-count');
  const searchInput = document.getElementById('search-input');
  const roleFilter = document.getElementById('role-filter');
  const sortSelect = document.getElementById('sort-select');
  const exportBtn = document.getElementById('btn-export');
  const logoutBtn = document.getElementById('btn-logout');

  // Modal elements
  const modal = document.getElementById('detail-modal');
  const modalClose = document.getElementById('modal-close');
  const modalContent = document.getElementById('modal-body-content');

  // Local state
  let submissions = [];

  // Role style indices to matches styles
  const roleClassMap = {
    'President / Club Lead': 'badge-role-1',
    'Vice President': 'badge-role-2',
    'Technical Lead (Programming)': 'badge-role-3',
    'Art & Design Lead': 'badge-role-4',
    'Game Design Lead': 'badge-role-5',
    'Marketing & Social Media Lead': 'badge-role-6',
    'Event Coordinator': 'badge-role-7',
    'Outreach & Community Manager': 'badge-role-8',
  };

  // =============================================
  // DATA FETCHING & RENDERING
  // =============================================

  async function fetchSubmissions() {
    const role = roleFilter.value;
    const search = searchInput.value.trim();
    const sort = sortSelect.value;

    let url = `/api/admin/submissions?sort=${sort}`;
    if (role !== 'all') url += `&role=${encodeURIComponent(role)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    try {
      const res = await fetch(url);
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }

      submissions = await res.json();
      renderSubmissions();
      updateStats();
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
  }

  function renderSubmissions() {
    listContainer.innerHTML = '';
    listCountBadge.textContent = `${submissions.length} Submission${submissions.length === 1 ? '' : 's'}`;

    if (submissions.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔍</div>
          <h3>No applications found</h3>
          <p>Try clearing filters or search terms.</p>
        </div>
      `;
      return;
    }

    submissions.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'submission-card';
      card.dataset.id = sub.id;

      const badgeClass = roleClassMap[sub.role_applied] || 'sub-role-badge';
      const formattedDate = new Date(sub.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      card.innerHTML = `
        <div class="sub-main-info">
          <div class="sub-meta">
            <span class="sub-title">${escapeHTML(sub.full_name)}</span>
            <span class="sub-role-badge ${badgeClass}">${escapeHTML(sub.role_applied)}</span>
            <span class="sub-year-badge">${escapeHTML(sub.year_of_study)}</span>
          </div>
          <div class="sub-contact">
            <span>✉️ ${escapeHTML(sub.email)}</span>
            <span>📱 ${escapeHTML(sub.phone)}</span>
            <span>📂 ${escapeHTML(sub.branch)}</span>
          </div>
          <div class="sub-date">Submitted on ${formattedDate}</div>
        </div>
        <div class="sub-actions">
          <button class="btn btn-secondary btn-view" style="padding: 0.5rem 1rem; font-size: 0.8rem;">View Details</button>
          <button class="btn btn-secondary btn-delete" style="padding: 0.5rem; border-color: rgba(239, 68, 68, 0.2); color: #fca5a5;" title="Delete submission">🗑️</button>
        </div>
      `;

      // Event Listeners
      card.querySelector('.btn-view').addEventListener('click', () => openModal(sub));
      card.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSubmission(sub.id, sub.full_name);
      });

      listContainer.appendChild(card);
    });
  }

  // =============================================
  // STATS GENERATION
  // =============================================

  async function updateStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) return;
      const stats = await res.json();

      document.getElementById('stat-total').textContent = stats.total;

      // Update Latest
      if (stats.latestSubmission) {
        const latestDate = new Date(stats.latestSubmission).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        document.getElementById('stat-latest').textContent = `Latest submission: ${latestDate}`;
      } else {
        document.getElementById('stat-latest').textContent = 'No applications yet';
      }

      // Update Top Choice Role
      if (stats.byRole && stats.byRole.length > 0) {
        const topRole = stats.byRole[0];
        document.getElementById('stat-top-role').textContent = topRole.role_applied.split(' ')[0] + '...'; // Shorten badge name
        document.getElementById('stat-top-role').title = topRole.role_applied;
        document.getElementById('stat-top-count').textContent = `${topRole.count} submission${topRole.count === 1 ? '' : 's'}`;
      } else {
        document.getElementById('stat-top-role').textContent = '-';
        document.getElementById('stat-top-count').textContent = '0 submissions';
      }

      // Percentage of first years
      if (stats.total > 0 && stats.byYear) {
        const firstYearsObj = stats.byYear.find(y => y.year_of_study === '1st Year');
        const firstYearsCount = firstYearsObj ? firstYearsObj.count : 0;
        const pct = Math.round((firstYearsCount / stats.total) * 100);
        document.getElementById('stat-first-years').textContent = `${pct}%`;
      } else {
        document.getElementById('stat-first-years').textContent = '0%';
      }

      // Available for interview count
      const totalInterview = submissions.filter(s => s.available_for_interview === 'Yes').length;
      document.getElementById('stat-interview').textContent = totalInterview;

    } catch (err) {
      console.error('Error updates stats:', err);
    }
  }

  // =============================================
  // DETAIL MODAL VIEW
  // =============================================

  function openModal(sub) {
    const formattedDate = new Date(sub.created_at).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const badgeClass = roleClassMap[sub.role_applied] || 'sub-role-badge';

    let answersHTML = '';
    const answers = sub.role_answers || {};

    if (sub.role_applied === 'President / Club Lead') {
      answersHTML = `
        <div class="qa-block">
          <div class="qa-question">Why lead & vision?</div>
          <div class="qa-answer">${escapeHTML(answers.vision)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Describe leadership experience:</div>
          <div class="qa-answer">${escapeHTML(answers.leadership_experience)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Conflict resolution style:</div>
          <div class="qa-answer">${escapeHTML(answers.conflict_resolution)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Comfortable representing club?</div>
          <div class="qa-answer">${escapeHTML(answers.comfortable_representing)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Weekly hours commit:</div>
          <div class="qa-answer">${escapeHTML(answers.weekly_hours)}</div>
        </div>
      `;
    } else if (sub.role_applied === 'Vice President') {
      answersHTML = `
        <div class="qa-block">
          <div class="qa-question">Good coordination vision:</div>
          <div class="qa-answer">${escapeHTML(answers.coordination_view)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Multitasking experience:</div>
          <div class="qa-answer">${escapeHTML(answers.multitasking_experience)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Comfortable stepping in as Lead?</div>
          <div class="qa-answer">${escapeHTML(answers.step_in_as_lead)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Weekly hours commit:</div>
          <div class="qa-answer">${escapeHTML(answers.weekly_hours)}</div>
        </div>
      `;
    } else if (sub.role_applied === 'Technical Lead (Programming)') {
      answersHTML = `
        <div class="qa-block">
          <div class="qa-question">Proficient Engines / Languages:</div>
          <div class="qa-answer">${escapeHTML(Array.isArray(answers.engines_languages) ? answers.engines_languages.join(', ') : answers.engines_languages)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Built Project / Repository Link:</div>
          <div class="qa-answer">${answers.project_link ? `<a href="${escapeHTML(answers.project_link)}" target="_blank" class="detail-val" style="color: var(--text-accent); text-decoration: underline;">${escapeHTML(answers.project_link)}</a>` : 'None'}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Beginner Workshop Plan:</div>
          <div class="qa-answer">${escapeHTML(answers.workshop_plan)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Mentoring Comfort Scale (1-5):</div>
          <div class="qa-answer">${escapeHTML(answers.mentoring_comfort)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Weekly hours commit:</div>
          <div class="qa-answer">${escapeHTML(answers.weekly_hours)}</div>
        </div>
      `;
    } else if (sub.role_applied === 'Art & Design Lead') {
      answersHTML = `
        <div class="qa-block">
          <div class="qa-question">Proficient Tools:</div>
          <div class="qa-answer">${escapeHTML(Array.isArray(answers.tools) ? answers.tools.join(', ') : answers.tools)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Art / Animation Portfolio Link:</div>
          <div class="qa-answer">${answers.portfolio ? `<a href="${escapeHTML(answers.portfolio)}" target="_blank" class="detail-val" style="color: var(--text-accent); text-decoration: underline;">${escapeHTML(answers.portfolio)}</a>` : 'None'}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Strongest Art Styles:</div>
          <div class="qa-answer">${escapeHTML(answers.art_styles)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">How to keep visual consistency:</div>
          <div class="qa-answer">${escapeHTML(answers.visual_consistency)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Weekly hours commit:</div>
          <div class="qa-answer">${escapeHTML(answers.weekly_hours)}</div>
        </div>
      `;
    } else if (sub.role_applied === 'Game Design Lead') {
      answersHTML = `
        <div class="qa-block">
          <div class="qa-question">Game design choice admiration:</div>
          <div class="qa-answer">${escapeHTML(answers.admired_game)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Designed mechanic / level / story description:</div>
          <div class="qa-answer">${escapeHTML(answers.design_experience)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Productive playtest plan:</div>
          <div class="qa-answer">${escapeHTML(answers.playtest_process)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Weekly hours commit:</div>
          <div class="qa-answer">${escapeHTML(answers.weekly_hours)}</div>
        </div>
      `;
    } else if (sub.role_applied === 'Marketing & Social Media Lead') {
      answersHTML = `
        <div class="qa-block">
          <div class="qa-question">Managed Pages / Campaigns Link:</div>
          <div class="qa-answer">${answers.campaign_links ? `<a href="${escapeHTML(answers.campaign_links)}" target="_blank" class="detail-val" style="color: var(--text-accent); text-decoration: underline;">${escapeHTML(answers.campaign_links)}</a>` : 'None'}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Platforms comfortable creating content for:</div>
          <div class="qa-answer">${escapeHTML(Array.isArray(answers.platforms) ? answers.platforms.join(', ') : answers.platforms)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Caption / Hashtags Pitch:</div>
          <div class="qa-answer">${escapeHTML(answers.caption_pitch)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Comfortable with basic design tools?</div>
          <div class="qa-answer">${escapeHTML(answers.design_tools_comfort)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Weekly hours commit:</div>
          <div class="qa-answer">${escapeHTML(answers.weekly_hours)}</div>
        </div>
      `;
    } else if (sub.role_applied === 'Event Coordinator') {
      answersHTML = `
        <div class="qa-block">
          <div class="qa-question">Event organizing helper experience:</div>
          <div class="qa-answer">${escapeHTML(answers.event_experience)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Last minute logistics handling scenario:</div>
          <div class="qa-answer">${escapeHTML(answers.logistics_problem)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Coordinating with college administration?</div>
          <div class="qa-answer">${escapeHTML(answers.admin_coordination)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Weekly hours commit:</div>
          <div class="qa-answer">${escapeHTML(answers.weekly_hours)}</div>
        </div>
      `;
    } else if (sub.role_applied === 'Outreach & Community Manager') {
      answersHTML = `
        <div class="qa-block">
          <div class="qa-question">Managed online community before?</div>
          <div class="qa-answer">${escapeHTML(answers.community_experience)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Onboarding welcome strategy:</div>
          <div class="qa-answer">${escapeHTML(answers.welcoming_plan)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Existing contacts (clubs/alumni/studios):</div>
          <div class="qa-answer">${escapeHTML(answers.existing_contacts)}</div>
        </div>
        <div class="qa-block">
          <div class="qa-question">Weekly hours commit:</div>
          <div class="qa-answer">${escapeHTML(answers.weekly_hours)}</div>
        </div>
      `;
    }

    modalContent.innerHTML = `
      <div class="detail-header">
        <h2 style="font-family: 'Outfit'; font-size: 1.6rem; font-weight: 700; margin-bottom: 0.2rem;">${escapeHTML(sub.full_name)}</h2>
        <span class="sub-role-badge ${badgeClass}">${escapeHTML(sub.role_applied)}</span>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.5rem;">Submitted: ${formattedDate}</div>
      </div>

      <div class="detail-section-title">General Information</div>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">Email</span><span class="detail-val">${escapeHTML(sub.email)}</span></div>
        <div class="detail-item"><span class="detail-label">Phone / WhatsApp</span><span class="detail-val">${escapeHTML(sub.phone)}</span></div>
        <div class="detail-item"><span class="detail-label">Year of Study</span><span class="detail-val">${escapeHTML(sub.year_of_study)}</span></div>
        <div class="detail-item"><span class="detail-label">Branch / Major</span><span class="detail-val">${escapeHTML(sub.branch)}</span></div>
        <div class="detail-item">
          <span class="detail-label">Portfolio Link</span>
          <span class="detail-val">
            ${sub.portfolio_link ? `<a href="${escapeHTML(sub.portfolio_link)}" target="_blank" style="color: var(--text-accent); text-decoration: underline;">${escapeHTML(sub.portfolio_link)}</a>` : 'Not provided'}
          </span>
        </div>
      </div>

      ${sub.previous_club_experience ? `
        <div class="detail-item" style="margin-bottom: 1.5rem;">
          <span class="detail-label">Previous Club/Society Experience</span>
          <div class="qa-block" style="margin-top: 0.3rem;"><span class="detail-val" style="white-space: pre-wrap;">${escapeHTML(sub.previous_club_experience)}</span></div>
        </div>
      ` : ''}

      <div class="detail-section-title">Role-Specific Answers</div>
      <div class="detail-qa">
        ${answersHTML}
      </div>

      <div class="detail-section-title">Final Section</div>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">Second Role Option</span><span class="detail-val">${escapeHTML(sub.second_role_choice || 'No second choice')}</span></div>
        <div class="detail-item"><span class="detail-label">Interview Availability</span><span class="detail-val">${escapeHTML(sub.available_for_interview)}</span></div>
      </div>

      ${sub.anything_else ? `
        <div class="detail-item" style="margin-top: 1rem;">
          <span class="detail-label">Anything Else</span>
          <div class="qa-block" style="margin-top: 0.3rem;"><span class="detail-val" style="white-space: pre-wrap;">${escapeHTML(sub.anything_else)}</span></div>
        </div>
      ` : ''}

      <div class="detail-section-title" style="margin-top: 1.5rem;">Technical Metadata</div>
      <div class="detail-grid" style="margin-bottom: 0;">
        <div class="detail-item"><span class="detail-label">IP Address</span><span class="detail-val" style="font-family: monospace; font-size: 0.8rem;">${escapeHTML(sub.ip_address)}</span></div>
        <div class="detail-item"><span class="detail-label">User Agent</span><span class="detail-val" style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4;">${escapeHTML(sub.user_agent)}</span></div>
      </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // =============================================
  // CATCH / PREVENT XSS IN USER INPUT
  // =============================================

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =============================================
  // SUBMISSION REMOVAL / DELETION
  // =============================================

  async function deleteSubmission(id, name) {
    if (!confirm(`Are you sure you want to delete ${name}'s application? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'DELETE',
      });

      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }

      if (res.ok) {
        fetchSubmissions();
      } else {
        alert('Failed to delete application.');
      }
    } catch (err) {
      console.error('Error deleting submission:', err);
    }
  }

  // =============================================
  // FILTERS & ACTIONS EVENT LISTENERS
  // =============================================

  // Change triggers
  roleFilter.addEventListener('change', fetchSubmissions);
  sortSelect.addEventListener('change', fetchSubmissions);

  // Debounced search
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchSubmissions, 300);
  });

  // Export CSV
  exportBtn.addEventListener('click', () => {
    window.location.href = '/api/admin/export/csv';
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/admin/login';
      }
    } catch (err) {
      console.error('Error logging out:', err);
    }
  });

  // Initialize data load
  fetchSubmissions();
});
