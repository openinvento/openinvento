
## Documentation

## Drag and Drop
To use drag and drop functionality, you can click and HOLD on an item to drag it to a new location. The application will provide visual feedback during the drag operation, and you can drop the item in a valid target area.
Via Drag and drop you can move articles and chests between shelves and areas. You can also move articles in chests.


#### Health check endpoint
The application provides a health check endpoint at `/api/health`. It returns a JSON response with status 200 indicating the health of the OpenInvento installation.

#### Update check
The application periodically checks for new releases and notifies instance administrators. It fetches all 24 hours the Github API for the latest release and compares it with the current version. If a new release is available, it sends an notification to the instance administrators.
Set the env variable `ENABLE_UPDATE_CHECKER` to `false` in the environment variables to disable this feature.


#### TODO: Move this into openinvento/docs repository -> website

