# Authentication Configuration

Kioskmanager supports both standard Django username/password authentication and OpenID Connect (OIDC) for accessing the admin portal. The method is configured during Helm deployment.

## Accessing the Admin Panel
Regardless of the method, the admin panel is typically accessed via `http://<your-kioskmanager-address>/admin/`.

## 1. Standard Django Authentication

This is the default method.
* Users are managed directly within Django (see [User Management](./user-management.md)).
* Login uses a username and password.
* The initial superuser is created based on `adminUser` and `adminPassword` Helm values (or corresponding environment variables `ADMIN_USERNAME`, `ADMIN_PASSWORD`).

**Helm Configuration:**
Set `auth.method: "standard"` in your Helm values (this is the default).

## 2. OpenID Connect (OIDC) Authentication

OIDC allows users to log in using an external Identity Provider (IdP) like Keycloak, Okta, Auth0, Azure AD, etc.

**Login Flow:**
1.  User navigates to the admin login page.
2.  If OIDC is enabled, a button like "Login with <OIDC Provider Name>" will be visible.
3.  Clicking this button redirects the user to your IdP's login page.
4.  User authenticates with the IdP.
5.  IdP redirects the user back to Kioskmanager.
6.  Kioskmanager validates the OIDC token, and either logs in an existing user or creates/updates a user based on the OIDC claims.
7.  Standard Django login fields will also be present on the login page, allowing local admin accounts to log in even if OIDC is the primary method for most users.

**Helm Configuration (`auth.method: "oidc"`):**
To enable OIDC, set `auth.method: "oidc"` in your Helm values and configure the `oidc` section:

* **Provider Discovery (Recommended):**
    * `oidc.opBaseDiscoveryUrl`: The URL to your IdP's `.well-known/openid-configuration` endpoint (e.g., `https://idp.example.com/auth/realms/myrealm`). This allows Kioskmanager to auto-discover other endpoints.

* **Explicit Endpoints (if discovery is not used/sufficient):**
    * `oidc.opAuthorizationEndpoint`: URL for authorization.
    * `oidc.opTokenEndpoint`: URL for token exchange.
    * `oidc.opUserEndpoint`: URL for fetching user information.
    * `oidc.opJwksEndpoint`: URL for JWKS (JSON Web Key Set) to verify token signatures.
    * `oidc.opIssuerEndpoint`: (Optional but often useful) The IdP's issuer identifier.

* **Client Configuration (Relying Party - Kioskmanager):**
    * `oidc.rpClientId`: **Required.** The Client ID obtained when registering Kioskmanager as an OIDC client with your IdP.
    * `oidc.rpClientSecret`: **Required.** The Client Secret for Kioskmanager. **This is sensitive and must be set securely** (e.g., via `--set oidc.rpClientSecret=YOURSECRET` during Helm install, not directly in `values.yaml` if committed to git).
    * `oidc.rpSignAlgo`: Algorithm your IdP uses to sign ID tokens (e.g., `RS256`).
    * `oidc.rpScopes`: Scopes Kioskmanager requests (e.g., `openid email profile groups`). Ensure your "groups" or roles scope is included if you want to map groups.
    * `oidc.providerName`: Text displayed on the OIDC login button (e.g., "Login with Company SSO").

* **User Provisioning & Attribute Mapping:**
    * `oidc.createUser`: (`true`/`false`) Whether to automatically create Django users if they don't exist after successful OIDC login.
    * `oidc.updateUserAttributes`: (`true`/`false`) Whether to update user's first name, last name, and email from OIDC claims on each login.
    * `oidc.usernameClaim`: OIDC claim used for the Django username (e.g., `email`, `preferred_username`, `sub`). **This claim's value MUST be unique across all users from your IdP.** Using `email` is common.
    * `oidc.claimFirstName`, `oidc.claimLastName`, `oidc.claimEmail`: Names of the OIDC claims to map to Django User's `first_name`, `last_name`, and `email` fields.

* **Group Mapping:**
    Allows Kioskmanager to automatically assign users to Django groups based on a claim from the OIDC token.
    * `oidc.groupsClaimName`: The name of the claim in the OIDC token that contains a list of group/role names (e.g., `groups`, `roles`). If empty, OIDC group sync is disabled.
    * `oidc.rpDjangoGroupsSyncEnabled`: Set to `true` to enable the sync of groups into Kioskmanager. The `groups` claim should contain a list of group names a user belongs to.
    * `oidc.assignContentManager`: If `true`, all users will be added to predefined `Content Managers` group.

* **Redirect URLs:**
    * `oidc.loginRedirectUrl`: Where to redirect after a successful OIDC login (default `/admin/`).
    * `oidc.logoutRedirectUrl`: Where to redirect after an OIDC-initiated logout (default `/`).

**Important Notes for OIDC Setup:**

* **Redirect URIs in IdP:** When registering Kioskmanager as an OIDC client in your IdP, you must provide a Redirect URI. This will typically be `http(s)://<your-kioskmanager-ingress-host>/oidc/callback/`.
* **Django Groups:** For group mapping to be effective, ensure the group names provided by your OIDC provider in the specified claim match the names of Groups you have configured in Django (e.g., "Content Managers"). You can let Kioskmanager create them if `oidc.rpCreateNewGroups` is true, but then you'll need to assign permissions to these newly created Django groups.
* **Debugging:** `mozilla-django-oidc` provides logging. Increase Django's log level for `mozilla_django_oidc` to DEBUG in your `settings.py` if you encounter issues.

Refer to the Helm chart's `values.yaml` for the exact parameter names and default values.