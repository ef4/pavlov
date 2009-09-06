/**
 * Pavlov - Behavioral API over QUnit
 * 
 * http://michaelmonteleone.net/projects/pavlov
 * http://github.com/mmonteleone/pavlov
 *
 * Copyright (c) 2009 Michael Monteleone
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 */
(function($){
    // capture reference to global scope 
    var globalScope = this;
    
    // ====================
    // = Example Building =
    // ====================

    var examples = [];
    var currentExample;

    /**
     * Example Class
     * Represents an instance of an example (a describe)
     * contains references to parent and nested examples
     * exposes methods for returning combined lists of before, after, and names
     * @constructor
     * @param {example} parent example to append self as child to (optional)
     */    
    function example(parent) {
        // private

        if(parent) {
            // if there's a parent, append self as nested example
            parent.children.push(this);
        } else {
            // otherwise, add this as a new root example
            examples.push(this);
        }

        var thisExample = this;        

        /**
         * Rolls up list of current and ancestors values for given prop name
         * @param {String} prop Name of property to roll up
         * @returns array of values corresponding to prop name
         */
        var rollup = function(prop) {
            var items = [];
            var node = thisExample;
            while(node !== null) {
                items.push(node[prop]);
                node = node.parent;
            }
            return items;
        };

        // public
        
        // parent example
        this.parent = parent ? parent : null;
        // nested examples
        this.children = [];
        // name of this description
        this.name = '';
        // function to happen before all contained specs
        this.before = function() {};
        // function to happen after all contained specs
        this.after = function() {};
        // array of it() tests
        this.specs = [];

        /**
         * rolls up this and ancestor's before functions
         * @returns arrayt of functions                  
         */
        this.befores = function(){
            return rollup('before').reverse();
        };
        /**
         * Rolls up this and ancestor's after functions
         * @returns array of functions
         */
        this.afters = function(){
            return rollup('after');
        };
        /**
         * Rolls up this and ancestor's description names, joined 
         * @returns string of joined description names
         */
        this.names = function(){
            return rollup('name').reverse().join(', ');     
        };
    }
    


    // ==============
    // = Assertions =
    // ==============
   
    /**
     * Collection of default-bundled assertion implementations
     */
    var assertions = {
        equals: function(actual, expected, message) {
            equals(actual, expected, message);
        },
        isEqualTo: function(actual, expected, message) {
            equals(actual, expected, message);
        },
        isNotEqualTo: function(actual, expected, message) {
            ok(actual !== expected, message);
        },
        isSameAs: function(actual, expected, message) {  
            same(actual, expected, message);
        },
        isNotSameAs: function(actual, expected, message) {            
            ok(!QUnit.equiv(actual, expected), message);
        },
        isTrue: function(actual, message) {     
            ok(actual, message);
        },
        isFalse: function(actual, message) {            
            ok(!actual, message);
        },
        isNull: function(actual, message) {
            ok(actual === null, message);
        },
        isNotNull: function(actual, message) {            
            ok(actual !== null, message);
        },
        isDefined: function(actual, message) {
            ok(typeof(actual) !== 'undefined', message);
        },
        isUndefined: function(actual, message) {
            ok(typeof(actual) === 'undefined', message);
        },
        pass: function(actual, message) {
            ok(true, message);
        },
        fail: function(actual, message) {
            ok(!true, message);
        },
        throwsException: function(actual, message) {
            try{
                actual();
                ok(!true, message);
            } catch(e) {
                ok(true, message);
            }
        }
    };

    /**
     * AssertionHandler
     * represents instance of an assertion regarding a particular 
     * actual value, and provides an api around asserting that value
     * against any of the bundled assertion handlers and custom ones.
     * @constructor
     * @param {Object} value A test-produced value to assert against
     */
    var assertHandler = function(value) {
        this.value = value;
    };
    /**
     * Appends assertion methods to the assertHandler prototype
     * For each provided assertion implementation, adds an identically named
     * assertion function to assertionHandler prototype which can run impl
     * @param {Object} asserts Object containing assertion implementations
     */
    var addAssertions = function(asserts) {
        $.each(asserts, function(name, fn){
            assertHandler.prototype[name] = function() {
                // implement this handler against backend
                // by pre-pending assertHandler's current value to args
                var args =  $.makeArray(arguments);
                args.unshift(this.value);           
                fn.apply(this, args);
            };
        }); 
    };
    // pre-add all the default bundled assertions
    addAssertions(assertions);



    // =====================
    // = Pavlov Public API =
    // =====================


    /**
     * Object containing methods to be made available as public API
     */
    var api = {
        /**
         * Initiates a new Example context
         * @param {String} description Name of what's being "described"
         * @param {Function} fn Function containing description (before, after, specs, nested examples)
         */
        describe: function(description, fn) {
            // capture reference to current example before construction
            var originalExample = currentExample;
            try{
                // create new current example for construction
                currentExample = new example(currentExample);
                currentExample.name = description;
                fn();        
            } finally {
                // restore original reference after construction
                currentExample = originalExample;
            }
        }, 

        /**
         * Sets a function to occur before all contained specs and nested examples' specs
         * @param {Function} fn Function to be executed         
         */
        before: function(fn) {
            currentExample.before = fn;
        },
        
        /**
         * Sets a function to occur after all contained tests and nested examples' tests
         * @param {Function} fn Function to be executed         
         */
        after: function(fn) {
            currentExample.after = fn;
        },
        
        /**
         * Creates a spec (test) to occur within an example
         * When not passed fn, creates a spec-stubbing fn which asserts fail "Not Implemented"
         * @param {String} specification Description of what "it" "should do"
         * @param {Function} fn Function containing a test to assert that it does indeed do it (optional)
         */
        it: function(specification, fn) {
            thisApi = this;
            if(fn) {
                currentExample.specs.push([specification, fn]);
            } else {
                // if not passed an implementation, create an implementation that simply asserts fail
                thisApi.it(specification, function(){thisApi.assert.fail('Not Implemented');});
            }
        },

        /**
         * Generates a row spec for each argument passed, applying 
         * each argument to a new call against the spec
         * @returns an object with an it() function for defining 
         * function to be called for each of given's arguments
         * @param {Array} arguments either list of values or list of arrays of values
         */
        given: function() {
            var args = arguments;
            var thisIt = this.it;

            return {
                /**
                 * Defines a row spec (test) which is applied against each
                 * of the given's arguments.
                 */
                it: function(specification, fn) {
                    $.each(args, function(){
                        var arg = this;
                        thisIt("given " + arg + ", " + specification, function(){ 
                            fn.apply(this, $.isArray(arg) ? arg : [arg]);
                        });
                    });
                }
            };
        },
        
        /**
         * Assert a value against any of the bundled or custom assertions
         * @param {Object} value A value to be asserted
         * @returns an assertHandler instance to fluently perform an assertion with
         */
        assert: function(value) {
            return new assertHandler(value);
        },

        /**
         * specifies test runner to synchronously wait
         * @param {Number} ms Milliseconds to wait
         * @param {Function} fn Function to execute after ms has 
         * passed before resuming
         */
        wait: function(ms, fn) {
            stop();
            QUnit.specify.globalObject.setTimeout(function(){
                fn();
                start();
            }, ms);
        }
    };

    // extend api's assert function for easier syntax for blank pass and fail
    $.extend(api.assert, {
        /**
         * Shortcuts assert().pass() with assert.pass()
         * @param {String} message Assertion message (optional)
         */
        pass: function(message){
            (new assertHandler()).pass(message);
        },
        /**
         * Shortcuts assert().fail() with assert.fail()
         * @param {String} message Assertion message (optional)
         */
        fail: function(message){
            (new assertHandler()).fail(message);
        }
    });

    /**
     * Extends a function's scope
     * applies the extra scope to the function returns un-run new version of fn
     * inspired by Yehuda Katz's metaprogramming Screw.Unit
     * different in that new function can still accept all parameters original function could
     * @param {Function} fn Target function for extending
     * @param {Object} thisArg Object for the function's "this" to refer
     * @param {Object} extraScope object whose members will be added to fn's scope
     * @returns Modified version of original function with extra scope.  Can still 
     * accept parameters of original function
     */
    var extendScope = function(fn, thisArg, extraScope) {

        // get a string of the fn's parameters
        var params = fn.toString().match(/\(([^\)]*)\)/)[1];
        // get a string of fn's body
        var source = fn.toString().match(/^[^\{]*\{((.*\n*)*)\}/m)[1];

        // create a new function with same parameters and
        // body wrapped in a with(extraScope){ }
        fn = new Function(
            "extraScope" + (params ?  ", " + params : ""), 
            "with(extraScope){" + source + "}");
        
        // returns a fn wrapper which takes passed args, 
        // pre-pends extraScope arg, and applies to modified fn
        return function(){ 
            var args = [extraScope];
            $.each(arguments,function(){
                args.push(this);
            });
            fn.apply(thisArg, args);
        };
    };

    /**
     * Top-level Specify method.  Declares a new QUnit.specify context
     * @param {String} name Name of what's being specified
     * @param {Function} fn Function containing exmaples and specs     
     */
    var specify = function(name, fn) {
        examples = [];
        currentExample = null;

        // set the test suite title
        $(function(){
            $('h1').html(name);
            $(document).attr('title', name + " Specifications");            
        });

        if(QUnit.specify.globalApi) { 
            // if set to extend global api, 
            // extend global api and run example builder
            $.extend(globalScope, api);
            fn(); 
        } else { 
            // otherwise, extend example builder's scope with api
            // and run example builder
            extendScope(fn, this, api)(); 
        }

        // compile examples into flat qunit statements
        var qunitStatements = compile(examples);

        // run qunit tests
        $.each(qunitStatements, function(){ this(); });
    };  




    // ==========================================
    // = Example-to-QUnit Statement Compilation =
    // ==========================================

    /**
     * Compiles nested set of examples into flat array of QUnit statements
     * @param {Array} examples Array of possibly nested Example instances
     * @returns array of QUnit statements each wrapped in an anonymous fn
     */
    var compile = function(examples) {
        var statements = [];

        /**
         * Comples a single example and its children into QUnit statements
         * @param {Example} example Single example instance 
         * possibly with nested instances
         */
        var compileDescription = function(example) {
            
            // get before and after rollups
            var befores = example.befores();
            var afters = example.afters();

            // create a module with setup and teardown 
            // that executes all current befores/afters
            statements.push(function(){
                module(example.names(), {
                    setup: function(){
                        $.each(befores, function(){ this(); });
                    },
                    teardown: function(){
                        $.each(afters, function(){ this(); });
                    }
                });
            });

            // create a test for each spec/"it" in the example
            $.each(example.specs, function(){
                var spec = this;
                statements.push(function(){
                    test(spec[0],spec[1]);
                });
            });
            
            // recurse through example's nested examples
            $.each(example.children, function() {
                compileDescription(this);            
            });
        };
        

        // compile all root examples
        $.each(examples, function() {
            compileDescription(this, statements);
        });

        return statements;
    };
    

    
    // =====================
    // = Expose Public API =
    // =====================

    // extend QUnit
    QUnit.specify = specify;
    // add global settings onto QUnit.specify
    $.extend(specify, {
        globalApi: false,                 // when true, adds api to global scope
        extendAssertions: addAssertions,  // function for adding custom assertions
        globalObject: window              // injectable global containing setTimeout and pals
    });

})(jQuery);

