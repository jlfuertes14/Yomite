Limitations and Requirements
MangaDex is a non-profit service operating with limited infrastructure resources.

To ensure the continued stability of our platform and combat abuse, we enforce a handful of restrictions on incoming request rate on an IP-by-IP basis. Hence, if you're on a VPN, proxy or a shared network in general, the requests of other users on this network might affect your allowance.

#General connection requirements
MangaDex supports HTTP/1.1, HTTP/2, and HTTP/3 over QUIC, and requires the usage of SSL/TLS for all of these.

SSL/TLS requirements




Additionally, the following requirements are placed on incoming HTTP requests:

The request MUST have a User-Agent header, and it must not be spoofed
The request CANNOT have a Via header (i.e.: we do not allow non-transparent proxies)
The following anti-abuse policies are in place:

We do not send CORS responses for other websites than ours; MUST proxy the requests your users make to our services, and inject your own CORS responses and headers where relevant

We will serve the wrong response for any image hotlinked from our domains; you MUST proxy the requests your users make to our services

Finally, an undocumented handful of IPv4 subnets are banned forever from reaching us.

#General rate limit
A global limit of approximately 5 requests per second per IP address is in effect for api.mangadex.org as a whole (and its development counterpart, api.mangadex.dev, independently).

Exact rate limit

Exceeded rate limit



Abusive patterns rate limit


Non-API rate limits

#Endpoint-specific rate limits
On top of this general limit, some endpoints are further restricted as follows, primarily to combat spam and/or mistaken API usage.

Most use-cases are highly unlikely to hit them in normal usage, since they mainly relate to data modification rather than consumption.

Endpoint	Requests per time period	Time period in minutes
AtHome (MangaDex@Home)		
GET /at-home/server/{id}	40	1
Authentication		
POST /auth/login	30	60
POST /auth/refresh	60	60
Author		
POST /author	10	60
PUT /author	10	1
DELETE /author/{id}	10	10
Captcha (reCaptcha)		
POST /captcha/solve	10	10
Cover		
POST /cover	100	10
PUT /cover/{id}	100	10
DELETE /cover/{id}	10	10
Chapter		
POST /chapter/{id}/read	300	10
PUT /chapter/{id}	10	1
DELETE /chapter/{id}	10	1
Forums		
POST /forums/thread	10	1
Manga		
POST /manga	10	60
PUT /manga/{id}	10	60
DELETE /manga/{id}	10	10
POST /manga/draft/{id}/commit	10	60
GET /manga/random	60	1
Reports		
POST /report	10	1
GET /report	10	1
ScanlationGroup		
POST /group	10	60
PUT /group/{id}	10	1
DELETE /group/{id}	10	10
Upload		
-> Sessions		
GET /upload	30	1
POST /upload/begin	20 (shared with ⬇️)	1
POST /upload/begin/{id}	20 (shared with ⬆️)	1
POST /upload/{id}/commit	10	1
DELETE /upload/{id}	30	1
-> Files		
POST /upload/{id}	250 (shared with ⬇️)	1
DELETE /upload/{id}/{id}	250 (shared with ⬆️⬇️)	1
DELETE /upload/{id}/batch	250 (shared with ⬆️)	1
Calling these endpoints will provide extra details via the following response headers:

Header	Description
X-RateLimit-Limit	Maximal number of requests this endpoint allows per its time period
X-RateLimit-Remaining	Remaining number of requests within your quota for the current time period
X-RateLimit-Retry-After	Timestamp of the end of the current time period, as UNIX timestamp
#Collection result sizes
Endpoints returning a collection of elements (such as the searches and feeds endpoints), typically take an offset and a size query parameters.

Requests where offset + size > 10.000 will be rejected.
The size query parameter will typically not allow values greater than 100 (500 for a handful of feed endpoints); you must instead use multiple requests with changing offsets to paginate through large responses.
This is for performance reasons and will not change.


Static Data
#Language Codes & Localization
To denote Chapter Translation language, translated fields such as Titles and Descriptions, the API expects a 2-letter language code in accordance with the ISO 639-1 standard. Additionally, some cases require the 5-letter extension if the alpha-2 code is not sufficient to determine the correct sub-type of a language, in the style of $language-$region, e.g. zh-hk or pt-br.

Because there is no standardized method of denoting romanized translations, we chose to append the -ro suffix. For example the romanized version of 五等分の花嫁 is 5Toubun no Hanayome or Gotoubun no Hanayome. Both would have the ja-ro language code, alternative versions are inserted as alternative titles. This is a clear distinction from the localized en translation The Quintessential Quintuplets

Notable exceptions are in the table below, otherwise ask a staff member if unsure.

alpha-5	Description
zh	Simplified Chinese
zh-hk	Traditional Chinese
pt-br	Brazilian Portugese
es	Castilian Spanish
es-la	Latin American Spanish
ja-ro	Romanized Japanese
ko-ro	Romanized Korean
zh-ro	Romanized Chinese
#Manga publication demographic
Value	Description
shounen	Manga is a Shounen
shoujo	Manga is a Shoujo
josei	Manga is a Josei
seinen	Manga is a Seinen
#Manga status
Value	Description
ongoing	Manga is still going on
completed	Manga is completed
hiatus	Manga is paused
cancelled	Manga has been cancelled
#Manga reading status
Value
reading
on_hold
plan_to_read
dropped
re_reading
completed
#Manga content rating
Value	Description
safe	Safe content
suggestive	Suggestive content
erotica	Erotica content
pornographic	Pornographic content
#Manga order options
Name	Value	Default
title	Enum: "asc", "desc"	
year	Enum: "asc", "desc"	
createdAt	Enum: "asc", "desc"	
updatedAt	Enum: "asc", "desc"	
latestUploadedChapter	Enum: "asc", "desc"	"desc"
followedCount	Enum: "asc", "desc"	
relevance	Enum: "asc", "desc"	
#Chapter order options
Name	Value	Default
createdAt	Enum: "asc", "desc"	"asc"
updatedAt	Enum: "asc", "desc"	"asc"
publishAt	Enum: "asc", "desc"	"asc"
readableAt	Enum: "asc", "desc"	"asc"
volume	Enum: "asc", "desc"	"asc"
chapter	Enum: "asc", "desc"	"asc"
#CustomList visibility
Value	Description
public	CustomList is public
private	CustomList is private
#Relationship types
Value	Description
manga	Manga resource
chapter	Chapter resource
cover_art	A Cover Art for a manga *
author	Author resource
artist	Author resource (drawers only)
scanlation_group	ScanlationGroup resource
tag	Tag resource
user	User resource
custom_list	CustomList resource
* Note, that on manga resources you get only one cover_art resource relation marking the primary cover if there are more than one. By default this will be the latest volume's cover art. If you like to see all the covers for a given manga, use the cover search endpoint for your mangaId and select the one you wish to display.

#Manga links data
In Manga attributes you have the links field that is a JSON object with some strange keys, here is how to decode this object:

Key	Related site	URL	URL details
al	anilist	https://anilist.co/manga/`{id}`	Stored as id
ap	animeplanet	https://www.anime-planet.com/manga/`{slug}`	Stored as slug
bw	bookwalker.jp	https://bookwalker.jp/`{slug}`	Stored as "series/"
mu	mangaupdates	https://www.mangaupdates.com/series.html?id=`{id}`	Stored as id
nu	novelupdates	https://www.novelupdates.com/series/`{slug}`	Stored as slug
kt	kitsu.io	https://kitsu.io/api/edge/manga/`{id}` or https://kitsu.io/api/edge/manga?filter[slug]={slug}	If integer, use id version of the URL, otherwise use slug one
amz	amazon	N/A	Stored as full URL
ebj	ebookjapan	N/A	Stored as full URL
mal	myanimelist	https://myanimelist.net/manga/{id}	Store as id
cdj	CDJapan	N/A	Stored as full URL
raw	N/A	N/A	Stored as full URL, untranslated stuff URL (original language)
engtl	N/A	N/A	Stored as full URL, official english licenced URL
#Manga related enum
This data is used in the "related" field of a Manga relationships

Value	Description
monochrome	A monochrome variant of this manga
colored	A colored variant of this manga
preserialization	The original version of this manga before its official serialization
serialization	The official serialization of this manga
prequel	The previous entry in the same series
sequel	The next entry in the same series
main_story	The original narrative this manga is based on
side_story	A side work contemporaneous with the narrative of this manga
adapted_from	The original work this spin-off manga has been adapted from
spin_off	An official derivative work based on this manga
based_on	The original work this self-published derivative manga is based on
doujinshi	A self-published derivative work based on this manga
same_franchise	A manga based on the same intellectual property as this manga
shared_universe	A manga taking place in the same fictional world as this manga
alternate_story	An alternative take of the story in this manga
alternate_version	A different version of this manga with no other specific distinction
#User roles enum
Value	Description
ROLE_ADMIN	MangaDex admins
ROLE_BANNED	Banned
ROLE_CONTRIBUTOR	Helpers contributing by filling in missing information (Description, External Links) on Manga pages on MangaDex
ROLE_DESIGNER	Designer
ROLE_DEVELOPER	MangaDex site developers
ROLE_FORUM_MODERATOR	Moderates the forum
ROLE_GLOBAL_MODERATOR	
ROLE_GROUP_LEADER	Leaders of active groups on MangaDex
ROLE_GROUP_MEMBER	Member of a group
ROLE_GUEST	Users viewing the site without being logged in
ROLE_MEMBER	A normal account
ROLE_MD_AT_HOME	Involved with the MangaDex@Home project
ROLE_POWER_UPLOADER	Uploaded 500 or more chapters to MangaDex
ROLE_PUBLIC_RELATIONS	Manages social media
ROLE_STAFF	Staff
ROLE_UNVERIFIED	Accounts that haven't had their email address verified yet
ROLE_USER	A normal account
ROLE_VIP	Important people that in one way or another helped MangaDex

Entity Comments
Entities on MangaDex generally support user comments, through our forums and with a layer of integration with our API.

The statistics-tagged endpoints are used to expose the existence (or lack thereof) of a forum thread for this entity, and of the number of comments so far.

These endpoints support both single and batch lookups.

#Example
Taking for example the manga Please Bully Me, Miss Villainess!.

Its id is 8b34f37a-0181-4f0b-8ce3-01217e9a602c.

First, we fetch its statistics:


GET https://api.mangadex.org/statistics/manga/8b34f37a-0181-4f0b-8ce3-01217e9a602c
Then we look for the $.statistics.$id.comments property in the response.

#The entity already has a comment thread
Then you receive the thread's id and reply count so far. For example:


{
  "result": "ok",
  "statistics": {
    "8b34f37a-0181-4f0b-8ce3-01217e9a602c": {
      "comments": {
        "threadId": 1069290,
        "repliesCount": 12
      },
      ...
    }
  }
}
This means that its comment thread is at https://forums.mangadex.org/threads/1069290 and has 12 replies.

#The entity doesn't have a comment thread yet
Then comments will have a value of literal null.


{
  "result": "ok",
  "statistics": {
    "8b34f37a-0181-4f0b-8ce3-01217e9a602c": {
      "comments": null,
      ...
    }
  }
}
You may open an entity's comment thread within our website, by clicking the comment counter of that entity.
Pagination
Sometimes there will be more results than the resource returns. The API enforces limitations to achieve high performance and encourages you to incorporate reasonable pagination.

This is achieved by using three props that are returned in tandem with the collection and setting the query parameters accordingly.

Name	Description
limit	The maximum number of items to include
offset	The offset on the collection
total	The total items in the collection
The maximum limit and offset are unique to each resource.

For example, for a collection with a total of 45 results, and each page containing 20 items the parameters for each page would be as follows:

Page	Parameter Values
1	limit: 20, offset: 0
2	limit: 20, offset: 20
3	limit: 20, offset: 40

reCaptcha
A small number of endpoints require a reCaptcha v3 token to proceed, in order to slow down automated malicious traffic.

Once an endpoint requires that a captcha needs to be solved, a 403 Forbidden response will be returned, with the error code captcha_required_exception. The sitekey needed for recaptcha to function is provided in both the X-Captcha-Sitekey header field, as well as in the error context, specified as siteKey parameter.

The captcha result of the client can either be passed into the repeated original request with the X-Captcha-Result header.

Authentication
Authentication against our API is made using the OAuth standard version 2.

#Authentication tokens and when to use them
In general, authentication tokens are passed as HTTP Authorization headers. For best performance:

Do not send authentication headers unless necessary for your API call. Authenticated requests cannot be cached, so you're slowing yourself down.

Do NOT send authentication headers to any domain other than {api, auth}.mangadex.org. This means NOT sending authentication headers to *.mangadex.network or uploads.mangadex.org (image download domains).

#The OAuth standard
We recommend you get familiar with the OAuth 2 specifications, or use some library that implements it for your language of choice.

Okta maintains a very comprehensive and simple documentation of the specification, alongside a list of tools and libraries.

15-minutes video summary of the OAuth standard

#OAuth and MangaDex
Once familiar with the OAuth specification, you will want an OAuth client of yours registered on our end. For simplicity, we will refer to those as "API clients" but they are effectively OAuth clients.

We aim to offer two types of API clients, based on the use-case.

1. Public clients (not available yet)





2. Personal clients






The summary is:

If you are developing a website/application and want other people to use it, use a public client
If you need a client for your own personal use only, a personal client is simpler and behaves closer to an API key

Personal clients
Only the account that owns a personal client can be used with it.
This is why it is a personal client. No other account can use it.

#Registering an API client
Go to https://mangadex.org/settings (make sure you are logged-in). Then open the API client section and follow the instructions there.

Once your client is requested, it will either be automatically approved, or be in a pending state, requiring manual approval by staff members.

If it is in a pending/requested state (instead of approved), it cannot be used yet.

We plan to enable automatic approval for personal client after a few weeks of experimentation with the feature available to the public.

#Client details
When your client is registered and approved/active.

Your client id is displayed and looks like this: personal-client-...
Your client secret is displayed upon clicking the Get Secret button
Your client secret is effectively a password
Never share it with anyone under any circumstance!
MangaDex staff will never ask you for it!

#Authenticating
Once you have your client id and secret, you will need your username and password to authenticate.

This is achieved by submitting an HTTP form:


POST https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token

grant_type=password
username=<your_username>
password=<your_password>
client_id=<your_client_id>
client_secret=<your_client_secret>
This is an HTTP form. NOT a Json payload. If done correctly, it should have request Content-Type application/x-www-form-urlencoded

Upon success, you will get back a Json object containing 2 properties like so:


{
  "access_token": "...",
  "refresh_token": "..."
}
This token pair is then used to perform authenticated requests against the API, alongside maintaining your authentication.

The access_token authenticated you with our API (https://api.mangadex.org), it has a lifetime of 15 minutes
The refresh_token allows you to quickly get a new access token (aka "refresh" it) when it has expired, from our authentication service (https://auth.mangadex.org)
Code samples

import requests

creds = {
    "grant_type": "password",
    "username": "<your_username>",
    "password": "<your_password>",
    "client_id": "<your_client_id>",
    "client_secret": "<your_client_secret>"
}

r = requests.post(
    "https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token",
    data=creds
)
r_json = r.json()

access_token = r_json["access_token"]
refresh_token = r_json["refresh_token"]

print(access_token, refresh_token)
#Refreshing your access token
Once an access token expires, it will start being rejected by the API and must be replaced ("refreshed").

This is achieved using the refresh_token flow, by sending another HTTP form:


POST https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token

grant_type=refresh_token
refresh_token=<your_refresh_token>
client_id=<your_client_id>
client_secret=<your_client_secret>
This is an HTTP form. NOT a Json payload. If done correctly, it should have request Content-Type application/x-www-form-urlencoded

Upon success, you will get back a Json object containing at least 1 access_token property, with your new access token in it:


{
  "access_token": "...",
  ...
}


Searching for a manga
This resource supports pagination and reference expansion.


  GET /manga
#Search via a query
One of the first steps made to navigate Mangadex's manga, manhwa, manhua, and/or user-submitted comics is to search for them through a query. The query we often want is the Manga's title. Thus, we pass a title query parameter to the URL, with the title we want to search for.

By default, the Manga list is provided in descending order, based on the latest chapter uploaded. See Manga order options.

Pornographic titles are hidden by default. For more information on Content Rating filters, read here.

#Request
Quering for the manga Kanojyo to Himitsu to Koimoyou.

Python
JavaScript

title = "Kanojyo to Himitsu to Koimoyou"

import requests

base_url = "https://api.mangadex.org"

r = requests.get(
    f"{base_url}/manga",
    params={"title": title}
)

print([manga["id"] for manga in r.json()["data"]])
#Advanced Manga search
Sometimes we may not be looking for a specific title, but many titles that are similar in some way. Sometimes we may be looking for action-romance stories, sometimes we're looking for that one amazing manga we forgot the title of, but remember ever so few characteristics about it. Our API provides a wide range of collection-filtering options, such as filtering by including or excluding tags, demographic, and more.

#Filtering by Tags
To filter a Manga collection by one or more Tags, we have to first understand how the Tag system works. We will use the includedTags[] and excludedTags[] query parameters to filter our list. Refer to the API reference for further details on the Tag system.

The default included tags mode is AND, meaning that a Manga has to contain all the tags specified to be included. The default excluded tags mode is OR, meaning that a Manga has to contain any of the tags specified to be omitted.

#Request
Let's look for a Manga with tags "Action" and "Romance," but not "Harem."

Python
JavaScript
We declare our tag names in a list.


included_tag_names = ["Action", "Romance"]
excluded_tag_names = ["Harem"]
We then transform those lists into lists of UUIDs using the /manga/tags resource.


import requests

base_url = "https://api.mangadex.org"

tags = requests.get(
    f"{base_url}/manga/tag"
).json()

# ["391b0423-d847-456f-aff0-8b0cfc03066b", "423e2eae-a7a2-4a8b-ac03-a8351462d71d"]
included_tag_ids = [
    tag["id"]
    for tag in tags["data"]
    if tag["attributes"]["name"]["en"]
       in included_tag_names
]

# ["aafb99c1-7f60-43fa-b75f-fc9502ce29c7"]
excluded_tag_ids = [
    tag["id"]
    for tag in tags["data"]
    if tag["attributes"]["name"]["en"]
       in excluded_tag_names
]
Finally, we send the request.


r = requests.get(
    f"{base_url}/manga",
    params={
        "includedTags[]": included_tag_ids,
        "excludedTags[]": excluded_tag_ids,
    },
)

print([manga["id"] for manga in r.json()["data"]])
#Sorting
You can apply sorting via the order field, see Manga order options.

Because the order field accepts deep object values, the query parameter will be in the shape of <field>[<key>]=<value>.

#Request
Python
JavaScript
We declare the order dictionary.


order = {
    "rating": "desc",
    "followedCount": "desc",
}
We transform the dictionary into a dictionary we can use for deep object query parameters.


final_order_query = {}

# { "order[rating]": "desc", "order[followedCount]": "desc" }
for key, value in order.items():
    final_order_query[f"order[{key}]"] = value
We send the request.


import requests

base_url = "https://api.mangadex.org"

r = requests.get(
    f"{base_url}/manga",
    params={
        **{
            "includedTags[]": included_tag_ids,
            "excludedTags[]": excluded_tag_ids,
        },
        **final_order_query,
    },
)

print([manga["id"] for manga in r.json()["data"]])
#Filtering by Demographic or Content Rating
You can filter the collection by specifying which demographics to include, what content rating to contain, its publication status and more. For the full list of what query parameters are available, refer to the API Reference.

#Request
Let's say we want to get all Seinen Manga with publication status completed, and suggestive content rating. We'll be using the publicationDemographic[], status[], and contentRating[] query parameters.

Python
JavaScript

filters = {
    "publicationDemographic[]": ["seinen"],
    "status[]": ["completed"],
    "contentRating[]": ["suggestive"],
}

import requests

base_url = "https://api.mangadex.org"

r = requests.get(
    f"{base_url}/manga", params=filters
)

print([manga["id"] for manga in r.json()["data"]])


Add Manga to Lists
This section requires authentication.

You can add Manga to:

Your Reading List to keep track of your reading library
Your Follows List to receive updates about new chapters
Your own Custom Lists to group Manga that you find similar in any form
#Adding Manga to a Reading List

 POST /manga/{id}/status
There are six kinds of reading lists, each with a straightforward meaning:

Reading
On Hold
Dropped
Plan to Read
Completed
Re-Reading
#Request
Let's add the manga Ichijou-San Wa Kao Ni Deyasui to a reading list as "reading."

Python
JavaScript

manga_id = "bbdaa3a3-ea49-4f12-9e1c-baa452f0830d"
status = "reading"

session_token = "somesessiontoken"

import requests

base_url = "https://api.mangadex.org"

r = requests.post(
    f"{base_url}/manga/{manga_id}/status",
    headers={
        "Authorization": f"Bearer {session_token}"
    },
    json={"status": status},
)

print(r.json()["result"])
To remove a Manga from a Reading List, pass a null value on the status field instead of one of the enums.

#Adding Manga to the Follows List

 POST /manga/{id}/follow
To receive updates on your feed when a new chapter is uploaded, you need to add the Manga to your Follows List.

#Request
Let's add the manga Alma-Chan Wants to Be a Family to our Follows List.

Since we don't pass a body for this endpoint, we can omit the Content-Type header.

Python
JavaScript

manga_id = "a37d2a4a-6caa-4ff3-84fe-f137f97b207c"

session_token = "somesessiontoken"

import requests

base_url = "https://api.mangadex.org"

r = requests.post(
    f"{base_url}/manga/{manga_id}/follow",
    headers={
        "Authorization": f"Bearer {session_token}"
    },
)

print(r.json()["result"])
#Adding Manga to a Custom List
To add a Manga into our Custom List, we first need to create that List.

#Creating and populating the Custom List

 POST /list
To create our Custom List, we need to decide on a name, and its visibility.

#Request
Our Custom List's name shall be "Hidden Gems" and it shall be visible to the public.

You may add Manga to the List just as you create it, by providing an array of Manga IDs in the manga field.

Python
JavaScript

options = {
    "name": "Hidden Gems",
    "visibility": "public",
}

session_token = "somesessiontoken"

import requests

base_url = "https://api.mangadex.org"

r = requests.post(
    f"{base_url}/list",
    headers={
        "Authorization": f"Bearer {session_token}"
    },
    json=options,
)

print(
    "List created with ID:",
    r.json()["data"]["id"],
)
#Updating the Manga in the Custom List

 PUT /list/{id}
Now that our Custom List has been created, and we have its ID, we can start updating what Manga it contains.

There aren't endpoints for adding or removing specific Manga to a Custom List. We will be managing that locally.

#Request
Python
JavaScript
We start by fetching the List and storing the Manga it contains.


list_id = "e1d40cf9-33e9-4e80-a64c-7354d4c520d3"

session_token = "somesessiontoken"

import requests

base_url = "https://api.mangadex.org"

r = requests.get(
    f"{base_url}/list/{list_id}",
    headers={
        "Authorization": f"Bearer {session_token}"
    },
)

manga_ids = [
    relationship["id"]
    for relationship in r.json()["data"]["relationships"]
    if relationship["type"] == "manga"
]

version = r.json()["data"]["attributes"]["version"]
We have to store the version sent to us if we want to update the List. This is to avoid cache issues with updating an outdated version of the resource.

Then, we update the List locally.


manga_ids_to_add = [
    "bbdaa3a3-ea49-4f12-9e1c-baa452f0830d",
    "8c21fe3b-4fe6-4f11-b51b-ced00d8aec60",
]

manga_ids_to_remove = [
    "719f4514-76c1-4efd-b7a1-331fa1e42eb6"
]

new_manga_ids = [
                    manga
                    for manga in manga_ids
                    if manga
                       not in (manga_ids_to_add + manga_ids_to_remove)
                ] + manga_ids_to_add
Finally, we send the request to update the List.


r = requests.put(
    f"{base_url}/list/{list_id}",
    headers={
        "Authorization": f"Bearer {session_token}"
    },
    json={
        "manga": new_manga_ids,
        "version": version,
    },
)


Retrieving Covers
To retrieve a cover, you need 2 pieces:

The manga id of the cover
The file name of the cover
Once you have these two, the URL of the cover is:


https://uploads.mangadex.org/covers/:manga-id/:cover-filename
In addition to the unaltered cover, we also provide two premade thumbnail sizes for each cover, with respective widths of 256 and 512 pixels.


https://uploads.mangadex.org/covers/:manga-id/:cover-filename.{256, 512}.jpg
Note that the full cover filename is still expected. Including the original extension.

That is, given the cover filename 26dd2770-d383-42e9-a42b-32765a4d99c8.png and URL


https://uploads.mangadex.org/covers/8f3e1818-a015-491d-bd81-3addc4d7d56a/26dd2770-d383-42e9-a42b-32765a4d99c8.png
The 256px and 512px thumbnails are 26dd2770-d383-42e9-a42b-32765a4d99c8.png.{256, 512}.jpg


https://uploads.mangadex.org/covers/8f3e1818-a015-491d-bd81-3addc4d7d56a/26dd2770-d383-42e9-a42b-32765a4d99c8.png.256.jpg
https://uploads.mangadex.org/covers/8f3e1818-a015-491d-bd81-3addc4d7d56a/26dd2770-d383-42e9-a42b-32765a4d99c8.png.512.jpg
#Where do I find the cover filename ?
You have two options depending on what you want.

#Main cover
In the manga's cover_art relationship you will find its cover id (which is not its filename). That cover entity has a filename attribute.

That relationship is always there and unique. It is the cover displayed on our website.

Finally, you can have the filename (and other attributes) resolved directly (avoiding the need for a subsequent call to /cover/:id) using reference expansion.

#All covers for a manga
Using the GET /cover endpoint.

Manga Statistics
MangaDex allows users to view a Manga's rating and post their own. Additionally, some other statistics are exposed.

#Seeing a Manga's rating

 GET /statistics/manga/{uuid}
A Manga's average rating is represented by an mean score, and a Bayesian score of values between 1 and 10.

Why Bayesian?
Bayesian scores start with a set bias. This is a method to avoid little-known Manga to be greatly affected by a few people's opinion. The Bayesian Average ultimately converges to the mean, as the reviews popoulate. Read more here.

The Bayesian Formula

  
 
 
 
 
  
  
  
 
 
 
 
  
 

  
 
#Request
Python
JavaScript

manga_id = "0301208d-258a-444a-8ef7-66e433d801b1"

import requests

base_url = "https://api.mangadex.org"

r = requests.get(f"{base_url}/statistics/manga/{manga_id}")

rating, follows, *others = r.json()["statistics"][manga_id].values()

print(
    f"Mean Rating: {rating.average}\n"
    + f"Bayesian Rating: {rating.bayesian}\n"
    + f"Follows: {follows}"
)

Searching for chapters
Listing chapters related to an entity typically relies on feeds. There are currently 3 chapter feed endpoints:

GET /manga/{id}/feed Will list all Chapter for a given Manga
GET /user/follows/manga/feed Will list all Chapter for your followed Manga
GET /list/{id}/feed Will list all Chapter for a given CustomList
(Please check the endpoint documentation for more details about each of these)

When not overridden, they all apply a default filter of publishAt <= NOW(). This is because we don't usually want chapters showing up before they are available.

The following query parameters can be used to override this behaviour:

includeEmptyPages is used to show Chapters with no pages available
includeFuturePublishAt is used to show Chapters with a publishAt date set in the future
includeExternalUrl is used to show Chapter that have an external url attached to them
Using any of them implicitly disables the default filter (which is equivalent to includeFuturePublishAt=0).

The "include" part of their name can be somewhat misleading. Read below.

Each filter has 3 possible values:

it is unset: and thus not applied in any way
1: Will require it to be true for all returned chapters
0: Will require it to be false for all returned chapters
#Examples

/manga/{id}/feed?includeFuturePublishAt=1
Shows only Chapters that have a publishAt value in the future. In that way it would be better names onlyFuturePublishAt.


/manga/{id}/feed?includeFuturePublishAt=0
Shows only Chapters that have a publishAt value in the past. In that case "include" is correct.


/manga/{id}/feed?includeFuturePublishAt=1&includeExternalUrl=0
Shows only Chapters with a publishAt value in the future and no external URL attached.

Retrieving a chapter's images
#Basics
MangaDex uses a variety of methods to distribute page files, both to optimize end-user performance and to save on bandwidth on our side.

This is usually achieved through MangaDex@Home, our volunteer CDN, rather than by pulling directly though us. This typically results in lower latency for you and saves bandwidth for us.

MangaDex additionally offers 2 image quality modes:

data: Original quality - pixel-for-pixel accurate to how the image was originally sent to us
data-saver: Compressed quality - Large size savings at the expense of image quality
Every single chapter page on the website is available in both qualities. The data-saver mode is offered mainly for americans people that still have to suffer stupid data caps in $CURRENT_YEAR.

#Howto
You need the ID of the chapter first. Then, by calling the GET /at-home/server/:chapterId endpoint, you'll get all required fields to compute your page URLs:


GET https://api.mangadex.org/at-home/server/:chapterId
Field	Type	Description
.baseUrl	string	A valid base URL
.chapter.hash	string	Chapter Hash
.chapter.data	array of strings	ordered data quality filenames
.chapter.dataSaver	array of strings	ordered data-saver quality filenames
The page URLs are then in the format

$.baseUrl / $QUALITY / $.chapter.hash / $.chapter.$QUALITY[*]

Important notes:

The validity of the base URL is limited in time. We guarantee 15 minutes. Could be more, could be less. Call the /at-home/server/:chapter-id again if you need it after that long but then get a 403 error.

It is not literally /$.chapter.dataSaver[*]. That is a placeholder to mean (all) the elements (filenames) within the data/data-saver arrays, depending on the quality and pages you want.

#Example
Assuming chapter id: a54c491c-8e4c-4e97-8873-5b79e59da210.

#1. Get the chapter's image delivery metadata

GET https://api.mangadex.org/at-home/server/a54c491c-8e4c-4e97-8873-5b79e59da210

{
  "result": "ok",
  "baseUrl": "https://uploads.mangadex.org",
  "chapter": {
    "hash": "3303dd03ac8d27452cce3f2a882e94b2",
    "data": [
      "1-f7a76de10d346de7ba01786762ebbedc666b412ad0d4b73baa330a2a392dbcdd.png",
      "2-2a5e95dfec7f15cd01f9a63835be18a22fb77a10fd2d62858c7dcbb6e6c622f9.png",
      "3-d06c6f764fdc3c76ea7ae3b76493fdf1a32b8926f2b60ed207b5c2fed13d002e.png",
      "4-a614d6456b9b13931bc5c5ef23cb5f744671f0e1e08c7335682a32de78482f71.png",
      "5-1105a368fd73ae99a06d7aebd165a1ff4322539ba50022a967f7b5fb0a185ce5.png",
      "6-e8a3eac12d879c541c4a36da550d2c69cc9450cb9b1840a079f890facf5f0c89.png"
    ],
    "dataSaver": [
      "1-27e7476475e60ad4cc4cefdb9b2dce29d84f490e145211f6b2e14b13bdb57f33.jpg",
      "2-b4e2cd69df2648279b7d87d44f7860d3fc760aa442e08c49579359f3cf4b4f14.jpg",
      "3-b45f66bdac44652ea2eae40bb5788afe34b8ab5a66e69f0d406257804ddaeda1.jpg",
      "4-92b328471cca1b032bd99cd8506c945a2c3b5a5fd32275b0c4dbfd8ddcfe7e0a.jpg",
      "5-b2336d540fe4a2f9f452cec8e4b2d2ef894f66535e45a4468bf59a6d37f025fe.jpg",
      "6-09f2deb563e802464c161bf7bfa2b094a4727efb4f962d30cf8ee2857a0a66c8.jpg"
    ]
  }
}
Here, the base url happens to be https://uploads.mangadex.org but it could be whatever else.

Typically it will be very different if it's a MangaDex@Home node. Do NOT assume any format. It is not "a URL", it is not "a domain name", it's not "https:// followed by a domain name".

It is a string. No more no less. Just use it as-is.

#2. Construct page URLs
The full URLs are then

DATA (source/original quality)


https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/1-f7a76de10d346de7ba01786762ebbedc666b412ad0d4b73baa330a2a392dbcdd.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/2-2a5e95dfec7f15cd01f9a63835be18a22fb77a10fd2d62858c7dcbb6e6c622f9.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/3-d06c6f764fdc3c76ea7ae3b76493fdf1a32b8926f2b60ed207b5c2fed13d002e.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/4-a614d6456b9b13931bc5c5ef23cb5f744671f0e1e08c7335682a32de78482f71.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/5-1105a368fd73ae99a06d7aebd165a1ff4322539ba50022a967f7b5fb0a185ce5.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/6-e8a3eac12d879c541c4a36da550d2c69cc9450cb9b1840a079f890facf5f0c89.png
DATA-SAVER (compressed):


https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/1-27e7476475e60ad4cc4cefdb9b2dce29d84f490e145211f6b2e14b13bdb57f33.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/2-b4e2cd69df2648279b7d87d44f7860d3fc760aa442e08c49579359f3cf4b4f14.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/3-b45f66bdac44652ea2eae40bb5788afe34b8ab5a66e69f0d406257804ddaeda1.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/4-92b328471cca1b032bd99cd8506c945a2c3b5a5fd32275b0c4dbfd8ddcfe7e0a.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/5-b2336d540fe4a2f9f452cec8e4b2d2ef894f66535e45a4468bf59a6d37f025fe.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/6-09f2deb563e802464c161bf7bfa2b094a4727efb4f962d30cf8ee2857a0a66c8.jpg
Do NOT send authentication headers when fetching images.

If you hit our image servers with authentication headers, your request will be rejected.

If you hit a 3rd-party server on mangadex.network, you are leaking the authentication token to the third-party operating that MangaDex@Home node.

#MangaDex@Home, load successes, failures and retries
Sometimes, a request for an image will fail. There can be many reasons for that. Typically it is caused by an unhealthy MangaDex@Home server.

In order to keep track of the health of the servers in the network and to improve the quality of service and reliability, we need you to report successes and failures when loading images.

The MangaDex@Home report endpoint is for this. For each image you retrieve (successfully or not) from a base url that doesn't contain mangadex.org.

Call the network report endpoint to notify it (see just below)
Call the /at-home/server/:chapterId endpoint again to get a new base url if it was a failure
But it failed and I still get the same server back!!

Then call the endpoint. If you don't, we cannot know that the server you got assigned to isn't working.

#The MangaDex@Home report endpoint
It is a POST request to https://api.mangadex.network/report (note that it's api.mangadex.network, ** not** api.mangadex.org) as follows.


POST https://api.mangadex.network/report
Content-Type: application/json
Field	Type	Description
url	string	The full URL of the image (including https:// )
success	boolean	true if the image was successfully retrieved, false otherwise
cached	boolean	true iff the server returned an X-Cache header with a value starting with HIT
bytes	number	The size (in bytes) of the retrieved image
duration	number	The time (in miliseconds) that the complete retrieval (not TTFB) of the image took
Note 1: The content-type header must be exactly application/json. Note 2: It's api.mangadex.network, not apimangadex.org

#MangaDex@Home report examples
Let's assume that for the example chapter above your base url was: https://foo.bar:5678/abcdef/1a2b3c4d.

#Success

POST https://api.mangadex.network/report
Content-Type: application/json

{
  "url": "https://foo.bar:5678/abcdef/1a2b3c4d/data/3303dd03ac8d27452cce3f2a882e94b2/2-2a5e95dfec7f15cd01f9a63835be18a22fb77a10fd2d62858c7dcbb6e6c622f9.png",
  "success": true,
  "bytes": 674687,
  "duration": 235,
  "cached": true
}
#Failure

POST https://api.mangadex.network/report
Content-Type: application/json

{
  "url": "https://foo.bar:5678/abcdef/1a2b3c4d/data/3303dd03ac8d27452cce3f2a882e94b2/2-2a5e95dfec7f15cd01f9a63835be18a22fb77a10fd2d62858c7dcbb6e6c622f9.png",
  "success": false,
  "bytes": 25,
  "duration": 235,
  "cached": false
}
N.B.: On a failure that doesn't result in any response (connection failure, bad SSL certificate, ...) just put 0 for bytes.

#About hardcoding base URLs
Damn, I wish I could load images slower, waste MangaDex's bandwidth, and get IP banned! But how?

Hardcoding your base URL is a solid approach!

First of all: Don't. The dynamic URLs we return on the /at-home/server/:chapter-id endpoint are almost always optimized based on your geographic location, so this is typically just a dumb thing to do besides during basic prototyping of your project. We also have stricter rate-limits on those, etc.

But if you think that it is required for your use-case, feel free to explain your use-case in the #dev-talk-api channel on our Discord, and maybe we can figure something out.

You're probably gonna do it anyway if you were planning to. Just don't complain when it screws you over. Or do, we just won't particularly care.

Find a Manga's Chapters

 GET /manga/{id}/feed
After finding the manga we are looking for, we may now want to read its chapters. The first step is to find which chapter exactly we want.

#Getting the Manga Feed
Manga Feed is a Manga's Chapter collection. A Chapter resource contains various information useful for identifying the chapter we are looking for, such as the chapter number, volume, language, and more.

#Request
Python
JavaScript

manga_id = "f98660a1-d2e2-461c-960d-7bd13df8b76d"

import requests

base_url = "https://api.mangadex.org"

r = requests.get(f"{base_url}/manga/{manga_id}/feed")

print([chapter["id"] for chapter in r.json()["data"]])
#Filtering the Manga Feed
We may want to filter out chapters which we may not be interested in. Attributes like language, group, user, and others are all fields we can apply filters for. Refer to the API Reference for a list of all the available query parameters.

#Request
Suppose we want to get all English chapters for the Manga Kimi wa Shinenai Hai Kaburi no Majo.

We use the ISO language code "en" for "English." You can find other languages' codes here.

Python
JavaScript

manga_id = "7c145eaf-1037-48cb-b6ba-f259103b05ea"
languages = ["en"]

import requests

base_url = "https://api.mangadex.org"

r = requests.get(
    f"{base_url}/manga/{manga_id}/feed",
    params={"translatedLanguage[]": languages},
)

print([chapter["id"] for chapter in r.json()["data"]])
#Download a Chapter
Once we've found which chapter(s) we want, the next step would probably be to retrieve the images for it.

For a closer and more detailed look of this section, refer to Retrieving chapter pages.

Let's proceed with chapter 27cd0902-ad4c-490a-b752-ae032f0503c9.

#Request
Python
JavaScript

chapter_id = "27cd0902-ad4c-490a-b752-ae032f0503c9"

import requests

base_url = "https://api.mangadex.org"

r = requests.get(f"{base_url}/at-home/server/{chapter_id}")
r_json = r.json()

host = r_json["baseUrl"]
chapter_hash = r_json["chapter"]["hash"]
data = r_json["chapter"]["data"]
data_saver = r_json["chapter"]["dataSaver"]
Now, let's explain a few things. For every chapter, Mangadex provides two quality options: data and data-saver. data quality will always be original quality images (just like the uploader uploaded them), whereas data-saver are their compressed counterparts, which are low in size, meant for people who wish to conserve their bandwidth and for faster loading times on slow connections.

The full URL to retrieve an image is in the following format: <baseUrl>/<quality>/<chapterHash>/<filename>.

baseUrl is the URL we received from the /at-home/server endpoint (Always use the URL you receive from this endpoint. The at-home URLs are geographically optimized, therefore it's only going to cause issues for yourself by hardcoding them).
quality is the preferred quality option. Must be either data or data-saver.
chapterHash is the chapter hash the /at-home/server endpoint provides us with.
filename is the full name of the file under the quality option we chose.
#Request
Python
JavaScript

import os

# Making a folder to store the images in.
folder_path = f"Mangadex/{chapter_id}"
os.makedirs(folder_path, exist_ok=True)

import requests

for page in data:
    r = requests.get(f"{host}/data/{chapter_hash}/{page}")

    with open(f"{folder_path}/{page}", mode="wb") as f:
        f.write(r.content)

print(f"Downloaded {len(data)} pages.")
While downloading chapters from Mangadex is trivial, our CORS policy does not allow hotlinking of images. What that means is that you cannot make, say, a website where the users can read chapters from, with the at-home URLs. The only whitelisted domains are those owned by Mangadex, and localhost. To circumvent this, you may disable CORS from your browser's security settings, but know that if you're planning to distribute it to users, you must proxy those images from your server, and serve the images to them afterwards.
