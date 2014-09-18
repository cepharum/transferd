/**
 * (c) 2014 cepharum GmbH, Berlin, http://cepharum.de
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 cepharum GmbH
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * @author: Thomas Urban
 */

var FS   = require( "fs" );
var PATH = require( "path" );


// get configuration
var confDir  = process.env.CONFIGDIR || "/etc/transferd";
var basePath = PATH.resolve( process.env.WEBROOT || "/dev/null" );
var useHttps = true;

try {
	var sslKey  = FS.readFileSync( PATH.join( confDir, "ssl/key.pem" ) );
	var sslCert = FS.readFileSync( PATH.join( confDir, "ssl/cert.pem" ) );
} catch ( e ) {
	console.error( "ALERT: missing key/cert, thus running unencrypted" );
	useHttps = false;
}

var ip       = process.env.BINDIP   || "0.0.0.0";
var port     = process.env.BINDPORT || ( useHttps ? 8443 : 8080 );
var password = FS.readFileSync( PATH.join( confDir, "secret" ) ).toString().trim();



function FolderListing( path, onDone ) {
    var todo = [ path ],
        result = [];

    function next() {
        if ( todo.length ) {
        	var name = todo.shift();

            FS.stat( name, function( error, stat ) {
                if ( error ) {
                    console.error( "LIST: failed to stat: " + name + " (" + error + ")" );
                    next();
                } else if ( stat.isDirectory() ) {
                    FS.readdir( name, function( error, files ) {
                        if ( error ) {
                            console.error( "LIST: failed to enumerate: " + name + " (" + error +")" );
                        } else {
                            todo = files.map( function( file ) { return PATH.join( name, file ); } ).concat( todo );
                        }

                        next();
                    } );
                } else {
                	result.push( PATH.relative( path, name ) );
                	next();
                }
            } );
        } else {
            onDone( result );
        }
    }

    next();
}

// implement request handler
function onRequest( req, res ) {
	console.error( "DEBUG: " + req.method + " " + req.url + " from " + req.socket.remoteAddress );

	var url = require("url").parse( req.url, true ),
		token = new Buffer( 0 );

	req.on( "data", function( chunk ) {
		token = Buffer.concat( [ token, chunk ] );
	} );

	req.on( "end", function() {
		if ( password !== token.toString().trim() ) {
			console.error( "DEBUG: invalid token" );
		    res.writeHead( 403 );
		    res.end();
		    return;
		}

		var name = decodeURI( url.pathname );
		if ( name.indexOf( ".." ) >= 0 ) {
			console.error( "DEBUG: invalid pathname" );
			res.writeHead( 403 );
			res.end();
			return;
		}

		var parts = /^\/(list|get|delete)(\/.*)?$/i.exec( name );
		if ( !parts ) {
			console.error( "DEBUG: invalid URL" );
			res.writeHead( 400 );
			res.end();
			return;
		}

		name = parts[2];

		switch ( parts[1].toLowerCase() ) {
			case "list" :
	            FolderListing( PATH.join( basePath, name ), function( files ) {
		            res.writeHead( 200, { "Content-Type": "application/json" } );
		            res.end( JSON.stringify( files ) );
	            } );
				break;

			case "get" :
				FS.readFile( PATH.join( basePath, name ), function( error, file ) {
					if ( error ) {
						console.error( "GET " + name + ": " + error );
						res.writeHead( 404 );
						res.end();
					} else {
			            res.writeHead( 200, { "Content-Type": "application/octet-stream" } );
						res.end( file );
					}
				} );
				break;

			case "delete" :
				var fullname = PATH.join( basePath, name );

				if ( PATH.relative( basePath, fullname ).trim() === "" ) {
					console.error( "ERROR: invalid request for deleting webroot" );
					res.writeHead( 500 );
					res.end();
				} else {
					FS.unlink( fullname, function( error ) {
						if ( error ) {
							if ( error.code == "EISDIR" ) {
								FS.rmdir( PATH.join( basePath, name ), function( error ) {
									if ( error ) {
										console.error( "DELETE " + name + ": " + error );
										res.writeHead( 500 );
									}
									res.end();
								} );
								return;
							}

							console.error( "DELETE " + name + ": " + error );
							res.writeHead( 500 );
						}

						res.end();
					} );
				}
				break;
		}
	} );
}

function onListening() {
	console.error( "DEBUG: listening on " + ip + ":" + port + " for serving from " + basePath );
}

// create server
if ( useHttps ) {
	require( "https" ).createServer( { key: sslKey, cert: sslCert }, onRequest ).listen( port, ip, onListening );
} else {
	require( "http" ).createServer( onRequest ).listen( port, ip, onListening );
}
