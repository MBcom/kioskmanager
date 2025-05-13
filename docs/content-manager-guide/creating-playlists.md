# Creating Playlists & Managing Display Groups

Playlists determine what content is shown on a group of displays and in what order. In Kioskmanager, playlists are managed by adding "Content Items" to "Display Groups".

First, ensure you have [Logged into the Admin Panel](../getting-started.md). You should also have some [Content Items (Videos or Websites)](./managing-content-items.md) already added to the system.

## Understanding Display Groups

A **Display Group** is a way to categorize your screens. For example, you might have a group for "Lobby Screens," another for "Meeting Room Displays," and one for "Cafeteria TVs." Each group has its own independent playlist. Any browser (display) assigned to a group will show that group's playlist.

## Creating a New Display Group

1.  **Navigate to Display Groups:** From the admin dashboard, find your Kioskmanager application section (e.g., "PLAYER") and click "Add" next to "Display groups".
    * Alternatively, click "Display groups" to see the list, then click "Add display group" in the top right.
2.  **Name the Group:** Enter a clear and descriptive "Name" for your group (e.g., "Main Entrance Loop", "Product Showcase Area").
3.  **Managers (Optional):** If your Kioskmanager setup uses specific user permissions for managing groups, this field might be used by administrators to assign you. Typically, if you can create groups, you can manage their content.
4.  **Save:** Click **"Save and continue editing"**. This is important because you'll add content to this group on the same page.

## Building the Playlist for a Display Group

After saving a new group (and choosing "Save and continue editing"), or by clicking an existing group from the "Display groups" list, you'll be on the "Change display group" page. Scroll down to the section titled **"Playlist Entries"**. This is where you build the ordered list of content for this group.

Each row in "Playlist Entries" represents one item in your playlist:

1.  **Order:** This field determines the playback sequence.
    * Enter a number (e.g., `10`, `20`, `30`). Content items with lower numbers will play first.
    * It's good practice to use increments (like 10, 20, 30 instead of 1, 2, 3) so you can easily insert new items between existing ones later without renumbering everything (e.g., you can add an item with order `15`).
2.  **Content item:** This is where you select the actual video or website.
    * Click the dropdown menu or the magnifying glass icon.
    * Search for and select the desired Content Item (which you added in [Managing Content Items](./managing-content-items.md)) from the list that appears.
3.  **Adding More Items:**
    * To add the first item, fill in the blank row provided.
    * To add subsequent items, click the "**Add another Playlist Entry**" link. A new blank row will appear.
4.  **Repeat:** For each item you want in the playlist, create a new Playlist Entry row, assign an order number, and select the Content Item.
5.  **Deleting Items:** To remove an item from the playlist, check the "DELETE?" box on its row. The item will be removed from this playlist when you save (it will not be deleted from the system's Content Item library).
6.  **Save the Playlist:** Once you have arranged all your content items in the desired order, scroll to the bottom of the page and click **"Save"**.

The displays assigned to this Display Group will now begin playing this new playlist. Videos will play to completion, and websites will display for their configured duration before the player advances to the next item in the ordered loop.