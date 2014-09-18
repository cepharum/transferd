# transferd - a very simple file transfer service

(c) 2014, cepharum GmbH

## About

`transferd` was created for enumerating files available on a remote server for
fetching. It is very simple by providing three simple actions, only: enumerate,
fetch and delete. It was designed to serve in a particular situation where one
processing server resides behind some firewall enabling it to poll additional
files for processing from a remote server residing in public network.

This software has been created instead of using existing opportunities such as
`ftp` or `pop3` combined with `fetchmail` for the latter requiring complex
setups and usually featuring additional actions not required and not even
desired here.

## Installation

The server script isn't forking for running in background itself, but relies on
system to put it into background on demand. In Ubuntu this might be achieved by
creating an Upstart task description. Alternatively one can use `daemontools`
for running the script as a background service.

The service is logging on _stderr_ and _stdout. On using Upstart this output is
written into file in `/var/log/upstart` matching name of your task definition.

## Usage

The service consists of two separate scripts. One of them must be run on a
server providing files while the other one is a client-side script used to ask
that server for enumerating files in a folder, fetching or delete one of them.

### Server-Side Script

The server side is available in script `server.js`.

#### Configuration Files

The server script is reading some files used in configuring it. Those files are
read from `/etc/transferd` or any other folder selected in environment (see
below):

##### SSL-certificate for encrypted operation

The server reads an SSL certificate from files `/etc/transferd/key.pem` and
`/etc/transferd/cert.pem`. If either one is missing, the service works without
encryption.

> Encryption is essential for secure operation. Thus, you shouldn't work without
in a production environment.

> Ensure either file is only readable by user the server script is running as.

##### Password File

The server is reading a password from `/etc/transferd/secret`. Every request
must provide this password in request body to be processed. On comparing
passwords either one is processed as a trimmed string. Thus, password might 8
characters long. It might be 64 KiBytes of multiline text, but leading and
trailing white space is ignored.

> Ensure password file is only readable by user the server script is running as.

#### Runtime Environment

The server side script is processing selected environments.

##### CONFIGDIR

This variable provides pathname of folder to read configuration files from. The
default is `/etc/transferd`.

##### WEBROOT

This variable is providing pathname of folder containing files to be served. The
default is `/dev/null`. Thus you must provide some folder for proper operation.

> All files in selected folder the server-side script is permitted to read
and/or delete might be fetched and/or deleted on remote request. Thus you
shouldn't use `/` or `/etc` or similar here.

##### BINDIP

This variable selects different IP to bind server with. The default is `0.0.0.0`
enabling server side to listen on any IP of server.

##### BINDPORT

This variable selects different IP port to listen on for incoming requests. The
default depends on whether service is providing encrypted access or not.
Encrypted connections are available on port 8443 by default. On disabled
encryption server is listening on port 8080.

#### Examples

    node server.js

Invokes server providing files in `/dev/null` on 0.0.0.0:8443 if SSL certificate
is available in `/etc/transferd` and on 0.0.0.0:8080 if SSL certificate is
missing.

    WEBROOT=/home/johndoe/files node server.js

Invokes server providing files in `/home/johndoe/files` on 0.0.0.0:8443 if SSL
certificate is available in `/etc/transferd` and on 0.0.0.0:8080 if SSL
certificate is missing.

    WEBROOT=/home/johndoe/files CONFIGDIR=/home/johndoe/transferd node server.js

Invokes server providing files in `/home/johndoe/files` on 0.0.0.0:8443 if SSL
certificate is available in `/home/johndoe/transferd` and on 0.0.0.0:8080 if SSL
certificate is missing.

    WEBROOT=/home/johndoe/files CONFIGDIR=/home/johndoe/transferd BINDPORT=1234 node server.js

Invokes server providing files in `/home/johndoe/files` on 0.0.0.0:1234 if SSL
certificate is available in `/home/johndoe/transferd` and also on 0.0.0.0:1234
if SSL certificate is missing.


### The Client

The client is implemented in script `client.js`. It is requiring some comand
line arguments. The password is always read from _stdin_.

Basically the invocation consists of options, some command and an optionally
required pathname. The required option is for selecting remote server to connect
with.

    node client.js -s <server> [ <more options> ] <cmd> [ <pathname> ] <"client-side-password-file"

#### Command Line Arguments
##### Choosing Server (mandatory)

The remote server is selected by using one of the equivalent options `-s`,
`--server`, `--host` or `--hostname`. The option takes IP address or hostname
of remote server.

##### Choosing Port (optional)

The port on remote server to connect with is selected by using one of the
equivalent options `-p` or `--port`. The option takes numeric port number.

##### Choosing Command

The command is provided as first non-option argument, but might be given in an
option as well using one of the equivalent names `-c`, `--cmd` or `--command`.

##### Choosing Pathname

The pathname is provided as second non-option argument, but might be given in an
option as well using one of the equivalent names `-f`, `--path` or `--pathname`.

##### Disabling Encryption

The client tries to connect with server encryptedly. If server isn't providing
encrypted connection the client must be invoked with additional option
`--nossl`.

#### Supported Commands

The client supports the following commands.

##### `list` - Listing Available Files

This command doesn't require pathname. The pathname may select subfolder for
limited enumeration.

##### `get` - Fetching File

This command requires pathname selecting file to fetch from remote server.

##### `delete` - Delete Remote File

This command requests server to delete file available for fetching. The file's
relative pathname is required as additional argument.

### Examples

    node client.js -s my.example.com list <<<"token"
    
Requests server on host `my.example.com` to enumerate all files available for 
fetching.

    node client.js -s my.example.com get /test.file <<<"token"
    
Fetches file `test.file` from host `my.example.com`.

    node client.js -s my.example.com -c get -f /test.file <<<"token"
    
Requests same action as before.

    node client.js -s my.example.com --nossl get /test.file <<<"token"
    
Fetches file `test.file` from host `my.example.com` over unencrypted connection.

    node client.js -s my.example.com --nossl delete /test.file <<<"token"
    
Request to delete file `test.file` on host `my.example.com` over unencrypted connection.
