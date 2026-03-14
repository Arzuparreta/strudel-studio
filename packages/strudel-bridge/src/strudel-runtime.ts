/**
 * Single entry that imports web, webaudio and soundfonts so they
 * share one dependency graph and one @strudel/core instance (avoids "loaded more than once").
 */
import * as web from "@strudel/web";
import * as webaudio from "@strudel/webaudio";
import * as soundfonts from "@strudel/soundfonts";

export { web, webaudio, soundfonts };
