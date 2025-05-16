# User Management & Permissions

Kioskmanager utilizes Django's robust authentication and authorization system. Managing users and their permissions is typically an administrator's responsibility.

## Creating User Accounts

1.  **Log in:** Access the [Kioskmanager Admin Panel](../getting-started.md) with superuser privileges.
2.  **Navigate to Users** 
3.  **Enter Credentials:**
    * Provide a unique "Username".
    * Enter a strong "Password" and confirm it.
4.  **Save Initial User:** Click "Save". You will be redirected to the "Change user" page to set further details.
5.  **User Details & Content Managers:**
    * Fill in "First name", "Last name", and "Email address" if desired.
    * **Crucially**, under the "Permissions" section, check the **"Staff status"** box. Users must be staff to log into the admin panel.
    * Check **"Superuser status"** only if this user should have all permissions (e.g., another administrator). For regular content managers, leave this unchecked.
6.  **Save Changes:** Click "Save".

## Understanding Roles and Permissions

Kioskmanager is designed with a few key roles in mind:

* **Superusers:** Have unrestricted access to all parts of the system. The initial `admin` user created during setup is a superuser.
* **Content Managers:** These users can log into the admin panel to manage content items (videos, websites) and the playlists for specific Display Groups they are assigned to. They typically do not have superuser privileges.

This is achieved through a combination of Django's "Groups" and specific model permissions.

## Setting Up a "Content Managers" Role (Group)

If not already set up by the system's startup script, you may need to create or verify a "Content Managers" group.

1.  **Navigate to Groups:** In the "AUTHENTICATION AND AUTHORIZATION" section, click on "Groups".
2.  **Add/Verify Group:**
    * Click "Add group" if it doesn't exist. Name it exactly `Content Managers`.
    * Select the necessary permissions from the "Available permissions" list and move them to the "Chosen permissions" box. Key permissions often include:
        * `kioskmanager | content item | Can add content item`
        * `kioskmanager | content item | Can change content item`
        * `kioskmanager | content item | Can view content item`
        * `kioskmanager | display group | Can view display group`
        * `kioskmanager | display group | Can change display group` (This allows them to edit playlist entries for groups they manage)
        * `kioskmanager | playlist entry | Can add playlist entry`
        * `kioskmanager | playlist entry | Can change playlist entry`
        * `kioskmanager | playlist entry | Can delete playlist entry`
        * `kioskmanager | playlist entry | Can view playlist entry`
    * Click "Save".

## Assigning Users to Roles

1.  **Assign to "Content Managers" Group:**
    * Go to the "Users" list and click on the username you want to configure.
    * On the "Change user" page, scroll to the "Groups" section.
    * Select "Content Managers" from "Available groups" and click the arrow to move it to "Chosen groups".
    * Click "Save". This user now has the general permissions of a Content Manager.

2.  **Assign Management of Specific Display Groups:**
    Even if a user is a Content Manager, they need explicit permission to manage the playlist of specific Display Groups.
    * Navigate to the "Display groups" list.
    * Click on the name of the Display Group you want this user to manage.
    * On the "Change display group" page, find the "Managers" field (it's a many-to-many field for users).
    * Select the user(s) from the "Available users" list and move them to the "Chosen users" box for this group.
    * Click "Save".

Repeat step 2 for every Display Group this user should manage. The user will now only be able to see and edit the playlists for these specifically assigned Display Groups.