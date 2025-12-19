import { PolicyResource } from './types';

export class PathMatcher {
    /**
     * Converts a path pattern with parameters (e.g., /users/:id) to a regex pattern
     */
    private pathToRegex(pathPattern: string): RegExp {
        // Escape special regex characters except for :
        const escaped = pathPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

        // Replace :param with regex pattern that matches any non-slash characters
        const pattern = escaped.replace(/:[^/]+/g, '[^/]+');

        return new RegExp(`^${pattern}$`);
    }

    /**
     * Checks if a request path matches a policy path pattern
     */
    matchPath(requestPath: string, policyPath: string): boolean {
        // Exact match first for performance
        if (requestPath === policyPath) {
            return true;
        }

        // Check if policy path has parameters
        if (!policyPath.includes(':')) {
            return false;
        }

        const regex = this.pathToRegex(policyPath);
        return regex.test(requestPath);
    }

    /**
     * Checks if a request matches any resource in the list
     */
    matchesAnyResource(
        requestPath: string,
        requestMethod: string,
        resources: PolicyResource[]
    ): boolean {
        for (const resource of resources) {
            // Check if path matches
            const pathMatches = this.matchPath(requestPath, resource.path);

            if (pathMatches) {
                // Check if method matches (case-insensitive)
                const methodMatches = resource.methods.some(
                    method => method.toUpperCase() === requestMethod.toUpperCase()
                );

                if (methodMatches) {
                    return true;
                }
            }
        }

        return false;
    }
}
