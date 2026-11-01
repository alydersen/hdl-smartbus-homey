# Contributing to the App development

First off all, thank you for taking the time to contribute!

The App is free and open source and built by people on their spare time, so please don't expect people to be as into your situation as you are. The best way to contribute is to code yourself, so please read [This excellent guide](https://www.contribution-guide.org)

## AI-assisted contributions

If you use an AI coding agent (Claude Code, Codex, Cursor, etc.) to work on this repository, have it read [AGENTS.md](AGENTS.md) before it starts. That file is the authoritative guide to the codebase: build/test commands, architecture, conventions, and the version bump procedure. It applies to all contributors, not just agents.

## Before submitting a bug, feature request or pull request

* **Have you actually read the error message**?
* Have you searched for similar issues?
* Have you updated homey, all apps, and the development tools (if applicable)?
* Have you checked that it's not a problem with one of the devices you're using, rather than the App itself?
* Have you looked at what's involved in fixing/implementing this?
 
Capable programmers should always attempt to investigate and fix problems themselves before asking for others to help. Submit a pull request instead of an issue!

## A great bug report contains

* Context – what were you trying to achieve?
* Detailed steps to reproduce the error from scratch. Try isolating the minimal amount of code needed to reproduce the error.
* Any applicable log files or ID's.
* Evidence you've looked into solving the problem and ideally, a theory on the cause and a possible solution.

## A great feature request contains

* The current situation.
* How and why the current situation is problematic.
* A detailed proposal or pull request that demonstrates how the problem could be solved.
* A use case – who needs this feature and why?
* Any caveats.

## A great pull request contains

* Minimal changes. Only submit code relevant to the current issue. Other changes should go in new pull requests.
* Minimal commits. Please squash to a single commit before sending your pull request.
* No conflicts. Please rebase off the latest master before submitting.
* Code conforming to the existing conventions and formats. i.e. Please don't reformat whitespace.
* Passing tests in the test folder. Run `npm test` before submitting. See `test/README.md` for details.
* Relevant documentation.

## Documentation

The documentation is the markdown files in the repository root, published at
[alydersen.github.io/hdl-smartbus-homey](https://alydersen.github.io/hdl-smartbus-homey/).
The site is rendered by [Docsify](https://docsify.js.org/) directly from these
files — there is no build step, and the same files also render on github.com.

When you contribute documentation:

* **New pages**: create the `.md` file in the repository root and add it to
  `_sidebar.md`. The sidebar is the only navigation on the site — a page that
  is missing from it can only be reached by typing its URL. Also link the page
  from `index.md` (the site's front page) and from other relevant pages.
* **Linking**: use relative links to the `.md` files
  (e.g. `[Relays](DEVICES_RELAYS.md)`). They work both on GitHub and on the
  documentation site.
* **Search**: automatic. The search plugin indexes the pages with headings up
  to and including `###` — give your pages meaningful headings.
* **Homepages**: `index.md` is the front page of the documentation site;
  `README.md` is the GitHub repository landing page and is not part of the
  site's navigation.
* **Naming**: device documentation is named `DEVICES_<TYPE>.md`, setup guides
  `GUIDE_<Topic>.md`.