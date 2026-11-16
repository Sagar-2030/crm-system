module.exports = {
  ROLES: ['superadmin', 'manager', 'agent'],
  STAGES: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Converted', 'Lost'],
  SOURCES: ['Website', 'Referral', 'Social Media', 'Email Campaign', 'Cold Call', 'Event', 'Other'],
  TASK_STATUSES: ['Pending', 'In Progress', 'Completed'],
  TASK_PRIORITIES: ['Low', 'Medium', 'High'],
  TASK_TYPES: ['Follow-up', 'Meeting', 'Call', 'Email'],
  ACTIVITY_TYPES: ['note', 'call', 'email', 'meeting', 'stage_change', 'assignment', 'created'],
  // Activity types a user may log manually
  MANUAL_ACTIVITY_TYPES: ['note', 'call', 'email', 'meeting'],
};
