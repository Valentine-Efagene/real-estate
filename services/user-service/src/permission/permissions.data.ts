import { PermissionName } from "./permission.enums";

export const PERMISSIONS = {
    admin: [
        PermissionName.READ_USERS,
        PermissionName.CREATE_USERS,
        PermissionName.UPDATE_USERS,
        PermissionName.DELETE_USERS,

        PermissionName.READ_ROLES,
        PermissionName.CREATE_ROLES,
        PermissionName.UPDATE_ROLES,
        PermissionName.DELETE_ROLES,

        PermissionName.READ_PERMISSIONS,
        PermissionName.CREATE_PERMISSIONS,
        PermissionName.UPDATE_PERMISSIONS,
        PermissionName.DELETE_PERMISSIONS,

        PermissionName.READ_EVENTS,
        PermissionName.CREATE_EVENTS,
        PermissionName.UPDATE_EVENTS,
        PermissionName.DELETE_EVENTS,

        PermissionName.READ_ACCESS_LOGS,
        PermissionName.CREATE_ACCESS_LOGS,
        PermissionName.UPDATE_ACCESS_LOGS,
        PermissionName.DELETE_ACCESS_LOGS,

        PermissionName.READ_SETTINGS,
        PermissionName.UPDATE_SETTINGS,

        PermissionName.READ_NOTIFICATIONS,
        PermissionName.CREATE_NOTIFICATIONS,
        PermissionName.UPDATE_NOTIFICATIONS,
        PermissionName.DELETE_NOTIFICATIONS,

        PermissionName.READ_ANALYTICS,
        PermissionName.CREATE_ANALYTICS,
        PermissionName.UPDATE_ANALYTICS,
        PermissionName.DELETE_ANALYTICS,

        PermissionName.READ_REPORTS,
        PermissionName.CREATE_REPORTS,
        PermissionName.UPDATE_REPORTS,
        PermissionName.DELETE_REPORTS,

        PermissionName.READ_MEDIA,
        PermissionName.CREATE_MEDIA,
        PermissionName.UPDATE_MEDIA,
        PermissionName.DELETE_MEDIA,
    ],
    user: [
        PermissionName.READ_PROFILE,
        PermissionName.UPDATE_PROFILE,

        PermissionName.READ_EVENTS,
        PermissionName.CREATE_EVENTS,
        PermissionName.UPDATE_EVENTS,
        PermissionName.DELETE_EVENTS,

        PermissionName.READ_NOTIFICATIONS,
        PermissionName.CREATE_NOTIFICATIONS,
        PermissionName.UPDATE_NOTIFICATIONS,
        PermissionName.DELETE_NOTIFICATIONS,
    ],
    staff: [
        PermissionName.READ_USERS,
        PermissionName.UPDATE_USERS,

        PermissionName.READ_EVENTS,
        PermissionName.CREATE_EVENTS,
        PermissionName.UPDATE_EVENTS,
        PermissionName.DELETE_EVENTS,

        PermissionName.READ_NOTIFICATIONS,
        PermissionName.CREATE_NOTIFICATIONS,
        PermissionName.UPDATE_NOTIFICATIONS,
        PermissionName.DELETE_NOTIFICATIONS,

        PermissionName.READ_ACCESS_LOGS,
        PermissionName.CREATE_ACCESS_LOGS,
        PermissionName.UPDATE_ACCESS_LOGS,
        PermissionName.DELETE_ACCESS_LOGS,
    ]
}