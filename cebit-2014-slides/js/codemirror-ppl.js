/*
 *	derived from mysql mode
 */
CodeMirror.defineMode("ppl", function (config) {
    var indentUnit = config.indentUnit;
    var curPunc;

    function wordRegexp(opts, words) {
        return new RegExp("^(?:" + words.join("|") + ")$", opts);
    }

    var ops = wordRegexp("i", [
        ('ms|milli(second)?s?'),
        ('sec(ond)?s?'),
        ('min(ute)?s?'),
        ('hours?'),
        ('days?'),
        ('wks?|weeks?'),
        ('mon(th)?s?|weeks?'),
        ('bimester'),
        ('trimester'),
        ('quarter'),
        ('semester'),
        ('yrs?|years?')
    ]);

    var keywords = wordRegexp("" , [
        ('over'),
        ('last'),
        ('current'),
        ('all'),
        ('as'),
        ('by'),
        ('every'),
        ('item'),
        ('total'),
        ('filter'),
        ('sort'),
        ('top'),
        ('asc'),
        ('desc'),
        ('true'),
        ('false'),
        ('null'),
        ('compress'),
        ('latest'),
        ('expand'),
        ('yield'),
        ('union'),
        ('join'),
        ('not'),
        ('and'),
        ('or'),
        ('xor')
    ]);

    function tokenBase(stream, state) {
        var ch = stream.next();
        curPunc = null;
        if (state.mcall) {
            state.mcall = null;
            if (ch.match(/[_\w\d]/)) {
                stream.eatWhile(/[_\w\d]/);
                return "variable-2";
            }
        }

        if (ch == "\"" || ch == "'") {
            state.tokenize = tokenLiteral(ch);
            return state.tokenize(stream, state);
        }
        else if (/[{}\(\),\.;\[\]]/.test(ch)) {
            curPunc = ch;
            return null;
        } else if (ch == '=' && stream.eat(">")) {
            state.post_filter = true;
            return "string-2";
        } else if (ch == ':' || ch=='#' || ch == '$') {
            if (state.post_filter)
                state.mcall = true;
            return "string-2";
        } else if (ch == '@') {
            stream.eatWhile(/[\w\d\._\-]/);
            return "number";
        }
        else {
            stream.eatWhile(/[_\w\d]/);
            var word = stream.current();
            if (ops.test(word))
                return "number";
            else if (keywords.test(word))
                return "keyword";
            else if (stream.peek() == "(")
                return "variable-2";
            else if (word == "_")
                return "string-2";
            else
                return "variable";
        }
    }

    function tokenLiteral(quote) {
        return function (stream, state) {
            var escaped = false, ch;
            while ((ch = stream.next()) != null) {
                if (ch == quote && !escaped) {
                    state.tokenize = tokenBase;
                    break;
                }
                escaped = !escaped && ch == "\\";
            }
            return "string";
        };
    }

    function tokenOpLiteral(quote) {
        return function (stream, state) {
            var escaped = false, ch;
            while ((ch = stream.next()) != null) {
                if (ch == quote && !escaped) {
                    state.tokenize = tokenBase;
                    break;
                }
                escaped = !escaped && ch == "\\";
            }
            return "variable-2";
        };
    }


    function pushContext(state, type, col) {
        state.context = {prev:state.context, indent:state.indent, col:col, type:type};
    }

    function popContext(state) {
        state.indent = state.context.indent;
        state.context = state.context.prev;
    }

    return {
        startState:function (base) {
            return {tokenize:tokenBase,
                context:null,
                indent:0,
                col:0};
        },

        token:function (stream, state) {
            if (stream.sol()) {
                if (state.context && state.context.align == null) state.context.align = false;
                state.indent = stream.indentation();
            }
            if (stream.eatSpace()) return null;
            var style = state.tokenize(stream, state);

            if (style != "comment" && state.context && state.context.align == null && state.context.type != "pattern") {
                state.context.align = true;
            }

            if (curPunc == "(") pushContext(state, ")", stream.column());
            else if (curPunc == "[") pushContext(state, "]", stream.column());
            else if (curPunc == "{") pushContext(state, "}", stream.column());
            else if (/[\]\}\)]/.test(curPunc)) {
                while (state.context && state.context.type == "pattern") popContext(state);
                if (state.context && curPunc == state.context.type) popContext(state);
            }
            else if (curPunc == "." && state.context && state.context.type == "pattern") popContext(state);
            else if (/atom|string|variable/.test(style) && state.context) {
                if (/[\}\]]/.test(state.context.type))
                    pushContext(state, "pattern", stream.column());
                else if (state.context.type == "pattern" && !state.context.align) {
                    state.context.align = true;
                    state.context.col = stream.column();
                }
            }

            return style;
        },

        indent:function (state, textAfter) {
            var firstChar = textAfter && textAfter.charAt(0);
            var context = state.context;
            if (/[\]\}]/.test(firstChar))
                while (context && context.type == "pattern") context = context.prev;

            var closing = context && firstChar == context.type;
            if (!context)
                return 0;
            else if (context.type == "pattern")
                return context.col;
            else if (context.align)
                return context.col + (closing ? 0 : 1);
            else
                return context.indent + (closing ? 0 : indentUnit);
        }
    };
});

CodeMirror.defineMIME("text/x-epl", "epl");
