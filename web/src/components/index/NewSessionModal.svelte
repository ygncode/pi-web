<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <div class="modal-sheet-header">
      <button class="modal-sheet-back" id="modalBackBtn" type="button" aria-label="Close Start a new session">
        <span aria-hidden="true">←</span>
        <span>Start a new session</span>
      </button>
    </div>
    <h2>Start a new session</h2>
    <div class="recent-locations" id="recentLocations"></div>
    <input type="text" id="sessionPath" placeholder="/path/to/project or ~/project">
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="createBtn">Create</button>
    </div>
    <div class="modal-error" id="modalError"></div>
  </div>
</div>
