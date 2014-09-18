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

var FS    = require( "fs" );
var PATH  = require( "path" );


// process command line arguments
var options = {
        method: "POST"
    },
    useHttps = true,
    name = false, command = false, value, split,
    args = process.argv.slice( 2 );

while ( args.length ) {
    value = args.shift();
    split = value.indexOf( "=" );

    if ( !name && split > 0 ) {
        name  = value.substr( 0, split );
        value = value.substr( split + 1 );
    }

    switch ( name || value ) {
        case "-s" :
        case "--server" :
        case "--host" :
        case "--hostname" :
            if ( name ) {
                options.hostname = value;
            }
            break;

        case "-p" :
        case "--port" :
            if ( name ) {
                options.port = value;
            }
            break;

        case "-nossl" :
        case "--nossl" :
            useHttps = false;
            value    = false;   // drop value to prevent making it name on next cycle
            break;

        case "-c" :
        case "--cmd" :
        case "--command" :
            if ( name ) {
                command = value.toLowerCase();
            }
            break;

        case "-f" :
        case "--path" :
        case "--pathname" :
            if ( name ) {
                options.path = value;
            }
            break;

        default :
            if ( name ) {
                console.error( "unknown option: " + name );
            } else {
                if ( command ) {
                    if ( options.path ) {
                        console.error( "invalid extra argument: " + value );
                    } else {
                        options.path = value;
                    }
                } else {
                    command = value.toLowerCase();
                }

                value = false;
            }
    }

    name = name ? false : value[0] === "-" ? value : false;
}

if ( !options.port ) {
    options.port = useHttps ? 8443 : 8080;
}

switch ( command ) {
    case "list" :
        if ( !options.path ) {
            options.path = "/";
        }
        break;

    case "get" :
    case "delete" :
        if ( options.path ) {
            break;
        }

        console.error( "missing pathname" );

    default :
        console.error( "\nusage: " + PATH.basename( require.main.filename ) + " -s <server> -p <port> (list|get|delete) [ <pathname> ]\n" );
        process.exit( 1 );
}

options.path = encodeURI( PATH.join( "/", command, options.path ) );


var request = require( useHttps ? "https" : "http" ).request( options, function( response ) {
    if ( response.statusCode !== 200 ) {
        console.error( "failed: " + response.statusCode );
        process.exit( 2 );
    }

    var data = new Buffer( 0 );

    if ( response.headers["content-type"] == "application/json" && command == "list" ) {
        response.on( "data", function( chunk ) {
            data = Buffer.concat( [ data, chunk ] );
        } );

        response.on( "end", function() {
            data = JSON.parse( data.toString() );
            if ( command == "list" && Array.isArray( data ) ) {
                data.forEach( function( line ) { console.log( line ); } );
            } else {
                console.error( "ERROR: invalid response from server" );
            }
        } );
    } else {
        response.pipe( process.stdout );
    }
} );

request.on( "error", function( error ) {
    console.error( error );
} );

process.stdin.pipe( request );
