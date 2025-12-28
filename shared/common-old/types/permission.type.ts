export enum PermissionName {
  // User permissions
  READ_USERS = 'read:users',
  CREATE_USERS = 'create:users',
  UPDATE_USERS = 'update:users',
  DELETE_USERS = 'delete:users',

  // Role permissions
  READ_ROLES = 'read:roles',
  CREATE_ROLES = 'create:roles',
  UPDATE_ROLES = 'update:roles',
  DELETE_ROLES = 'delete:roles',

  // Permission permissions
  READ_PERMISSIONS = 'read:permissions',
  CREATE_PERMISSIONS = 'create:permissions',
  UPDATE_PERMISSIONS = 'update:permissions',
  DELETE_PERMISSIONS = 'delete:permissions',

  // Event permissions
  READ_EVENTS = 'read:events',
  CREATE_EVENTS = 'create:events',
  UPDATE_EVENTS = 'update:events',
  DELETE_EVENTS = 'delete:events',

  // Access log permissions
  READ_ACCESS_LOGS = 'read:accessLogs',
  CREATE_ACCESS_LOGS = 'create:accessLogs',
  UPDATE_ACCESS_LOGS = 'update:accessLogs',
  DELETE_ACCESS_LOGS = 'delete:accessLogs',

  // Settings permissions
  READ_SETTINGS = 'read:settings',
  UPDATE_SETTINGS = 'update:settings',

  // Notification permissions
  READ_NOTIFICATIONS = 'read:notifications',
  CREATE_NOTIFICATIONS = 'create:notifications',
  UPDATE_NOTIFICATIONS = 'update:notifications',
  DELETE_NOTIFICATIONS = 'delete:notifications',

  // Analytics permissions
  READ_ANALYTICS = 'read:analytics',
  CREATE_ANALYTICS = 'create:analytics',
  UPDATE_ANALYTICS = 'update:analytics',
  DELETE_ANALYTICS = 'delete:analytics',

  // Report permissions
  READ_REPORTS = 'read:reports',
  CREATE_REPORTS = 'create:reports',
  UPDATE_REPORTS = 'update:reports',
  DELETE_REPORTS = 'delete:reports',

  // Media permissions
  READ_MEDIA = 'read:media',
  CREATE_MEDIA = 'create:media',
  UPDATE_MEDIA = 'update:media',
  DELETE_MEDIA = 'delete:media',

  // Profile permissions
  READ_PROFILE = 'read:profile',
  UPDATE_PROFILE = 'update:profile',
}
