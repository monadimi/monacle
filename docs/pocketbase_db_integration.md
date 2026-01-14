This project uses pocketbase as a database.

List/Search (cloud)
Fetch a paginated cloud records list, supporting sorting and filtering.

import PocketBase from 'pocketbase';

const pb = new PocketBase('https://monadb.snowman0919.site');

...

// fetch a paginated records list
const resultList = await pb.collection('cloud').getList(1, 50, {
filter: 'someField1 != someField2',
});

// you can also fetch all records at once via getFullList
const records = await pb.collection('cloud').getFullList({
sort: '-someField',
});

// or fetch only the first record that matches the specified filter
const record = await pb.collection('cloud').getFirstListItem('someField="test"', {
expand: 'relField1,relField2.subRelField',
});
JavaScript SDK
API details
GET
/api/collections/cloud/records

Query parameters
page Number The page (aka. offset) of the paginated list (default to 1).
perPage Number Specify the max returned records per page (default to 30).
sort String Specify the records order attribute(s).
Add - / + (default) in front of the attribute for DESC / ASC order. Ex.:
// DESC by created and ASC by id
?sort=-created,id
Supported record sort fields:
@random, @rowid, id, short_id, file, created, updated, owner, is_shared, expire_date, share_type

filter String Filter the returned records. Ex.:
?filter=(id='abc' && created>'2022-01-01')
expand String Auto expand record relations. Ex.:
?expand=relField1,relField2.subRelField
Supports up to 6-levels depth nested relations expansion.
The expanded relations will be appended to each individual record under the expand property (eg. "expand": {"relField1": {...}, ...}).
Only the relations to which the request user has permissions to view will be expanded.
fields String
Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.:
?fields=\*,expand.relField.name

- targets all keys from the specific depth level.

In addition, the following field modifiers are also supported:

:excerpt(maxLength, withEllipsis?)
Returns a short plain text version of the field string value.
Ex.: ?fields=\*,description:excerpt(200,true)
skipTotal Boolean If it is set the total counts query will be skipped and the response fields totalItems and totalPages will have -1 value.
This could drastically speed up the search queries when the total counters are not needed or cursor based pagination is used.
For optimization purposes, it is set by default for the getFirstListItem() and getFullList() SDKs methods.
Responses
{
"page": 1,
"perPage": 30,
"totalPages": 1,
"totalItems": 2,
"items": [
{
"collectionId": "pbc_4179273791",
"collectionName": "cloud",
"id": "test",
"short_id": "test",
"file": [
"filename.jpg"
],
"created": "2022-01-01 10:00:00.123Z",
"updated": "2022-01-01 10:00:00.123Z",
"owner": "test",
"is_shared": true,
"expire_date": "2022-01-01 10:00:00.123Z",
"share_type": "none"
},
{
"collectionId": "pbc_4179273791",
"collectionName": "cloud",
"id": "test2",
"short_id": "test",
"file": [
"filename.jpg"
],
"created": "2022-01-01 10:00:00.123Z",
"updated": "2022-01-01 10:00:00.123Z",
"owner": "test",
"is_shared": true,
"expire_date": "2022-01-01 10:00:00.123Z",
"share_type": "none"
}
]
}

View (cloud)
Fetch a single cloud record.

import PocketBase from 'pocketbase';

const pb = new PocketBase('https://monadb.snowman0919.site');

...

const record = await pb.collection('cloud').getOne('RECORD_ID', {
expand: 'relField1,relField2.subRelField',
});
JavaScript SDK
API details
GET
/api/collections/cloud/records/:id

Path Parameters
id String ID of the record to view.
Query parameters
expand String Auto expand record relations. Ex.:
?expand=relField1,relField2.subRelField
Supports up to 6-levels depth nested relations expansion.
The expanded relations will be appended to the record under the expand property (eg. "expand": {"relField1": {...}, ...}).
Only the relations to which the request user has permissions to view will be expanded.
fields String
Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.:
?fields=\*,expand.relField.name

- targets all keys from the specific depth level.

In addition, the following field modifiers are also supported:

:excerpt(maxLength, withEllipsis?)
Returns a short plain text version of the field string value.
Ex.: ?fields=\*,description:excerpt(200,true)
Responses
{
"collectionId": "pbc_4179273791",
"collectionName": "cloud",
"id": "test",
"short_id": "test",
"file": [
"filename.jpg"
],
"created": "2022-01-01 10:00:00.123Z",
"updated": "2022-01-01 10:00:00.123Z",
"owner": "test",
"is_shared": true,
"expire_date": "2022-01-01 10:00:00.123Z",
"share_type": "none"
}

Create (cloud)
Create a new cloud record.

Body parameters could be sent as application/json or multipart/form-data.

File upload is supported only via multipart/form-data.
For more info and examples you could check the detailed Files upload and handling docs .

import PocketBase from 'pocketbase';

const pb = new PocketBase('https://monadb.snowman0919.site');

...

// example create data
const data = {
"short_id": "test",
"owner": "test",
"is_shared": true,
"expire_date": "2022-01-01 10:00:00.123Z",
"share_type": "none"
};

const record = await pb.collection('cloud').create(data);
JavaScript SDK
API details
POST
/api/collections/cloud/records

Body Parameters
Optional
id
String Plain text value. It is autogenerated if not set.
Optional
short_id
String Plain text value.
Required
file
File File object.
Set to empty value (null, "" or []) to delete already uploaded file(s).
Required
owner
String Plain text value.
Optional
is_shared
Boolean
Optional
expire_date
String
Optional
share_type
String
Query parameters
expand String Auto expand relations when returning the created record. Ex.:
?expand=relField1,relField2.subRelField
Supports up to 6-levels depth nested relations expansion.
The expanded relations will be appended to the record under the expand property (eg. "expand": {"relField1": {...}, ...}).
Only the relations to which the request user has permissions to view will be expanded.
fields String
Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.:
?fields=\*,expand.relField.name

- targets all keys from the specific depth level.

In addition, the following field modifiers are also supported:

:excerpt(maxLength, withEllipsis?)
Returns a short plain text version of the field string value.
Ex.: ?fields=\*,description:excerpt(200,true)
Responses
{
"collectionId": "pbc_4179273791",
"collectionName": "cloud",
"id": "test",
"short_id": "test",
"file": [
"filename.jpg"
],
"created": "2022-01-01 10:00:00.123Z",
"updated": "2022-01-01 10:00:00.123Z",
"owner": "test",
"is_shared": true,
"expire_date": "2022-01-01 10:00:00.123Z",
"share_type": "none"
}

Update (cloud)
Update a single cloud record.

Body parameters could be sent as application/json or multipart/form-data.

File upload is supported only via multipart/form-data.
For more info and examples you could check the detailed Files upload and handling docs .

import PocketBase from 'pocketbase';

const pb = new PocketBase('https://monadb.snowman0919.site');

...

// example update data
const data = {
"short_id": "test",
"owner": "test",
"is_shared": true,
"expire_date": "2022-01-01 10:00:00.123Z",
"share_type": "none"
};

const record = await pb.collection('cloud').update('RECORD_ID', data);
JavaScript SDK
API details
PATCH
/api/collections/cloud/records/:id

Path parameters
id String ID of the record to update.
Body Parameters
Optional
short_id
String Plain text value.
Required
file
File File object.
Set to null to delete already uploaded file(s).
Required
owner
String Plain text value.
Optional
is_shared
Boolean
Optional
expire_date
String
Optional
share_type
String
Query parameters
expand String Auto expand relations when returning the updated record. Ex.:
?expand=relField1,relField2.subRelField21
Supports up to 6-levels depth nested relations expansion.
The expanded relations will be appended to the record under the expand property (eg. "expand": {"relField1": {...}, ...}). Only the relations that the user has permissions to view will be expanded.
fields String
Comma separated string of the fields to return in the JSON response (by default returns all fields). Ex.:
?fields=\*,expand.relField.name

- targets all keys from the specific depth level.

In addition, the following field modifiers are also supported:

:excerpt(maxLength, withEllipsis?)
Returns a short plain text version of the field string value.
Ex.: ?fields=\*,description:excerpt(200,true)
Responses
{
"collectionId": "pbc_4179273791",
"collectionName": "cloud",
"id": "test",
"short_id": "test",
"file": [
"filename.jpg"
],
"created": "2022-01-01 10:00:00.123Z",
"updated": "2022-01-01 10:00:00.123Z",
"owner": "test",
"is_shared": true,
"expire_date": "2022-01-01 10:00:00.123Z",
"share_type": "none"
}

Delete (cloud)
Delete a single cloud record.

import PocketBase from 'pocketbase';

const pb = new PocketBase('https://monadb.snowman0919.site');

...

await pb.collection('cloud').delete('RECORD_ID');
JavaScript SDK
API details
DELETE
/api/collections/cloud/records/:id

Path parameters
id String ID of the record to delete.
Responses
null

Realtime (cloud)
Subscribe to realtime changes via Server-Sent Events (SSE).

Events are sent for create, update and delete record operations (see "Event data format" section below).

You could subscribe to a single record or to an entire collection.

When you subscribe to a single record, the collection's ViewRule will be used to determine whether the subscriber has access to receive the event message.

When you subscribe to an entire collection, the collection's ListRule will be used to determine whether the subscriber has access to receive the event message.

import PocketBase from 'pocketbase';

const pb = new PocketBase('https://monadb.snowman0919.site');

...

// (Optionally) authenticate
await pb.collection('users').authWithPassword('test@example.com', '123456');

// Subscribe to changes in any cloud record
pb.collection('cloud').subscribe('_', function (e) {
console.log(e.action);
console.log(e.record);
}, { /_ other options like: filter, expand, custom headers, etc. \*/ });

// Subscribe to changes only in the specified record
pb.collection('cloud').subscribe('RECORD_ID', function (e) {
console.log(e.action);
console.log(e.record);
}, { /_ other options like: filter, expand, custom headers, etc. _/ });

// Unsubscribe
pb.collection('cloud').unsubscribe('RECORD_ID'); // remove all 'RECORD_ID' subscriptions
pb.collection('cloud').unsubscribe('_'); // remove all '_' topic subscriptions
pb.collection('cloud').unsubscribe(); // remove all subscriptions in the collection
JavaScript SDK
API details
SSE
/api/realtime

Event data format
{
"action": "create" // create, update or delete,
"record": {
"collectionId": "pbc_4179273791",
"collectionName": "cloud",
"id": "test",
"short_id": "test",
"file": [
"filename.jpg"
],
"created": "2022-01-01 10:00:00.123Z",
"updated": "2022-01-01 10:00:00.123Z",
"owner": "test",
"is_shared": true,
"expire_date": "2022-01-01 10:00:00.123Z",
"share_type": "none"
}
}
