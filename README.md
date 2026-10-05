# nodestep-stylesheet

> [!WARNING]
> Alpha (0.1.0a1). Anything may change between releases without a deprecation period, so pin a tag or a commit.

The stylesheet and two small scripts that the nodestep sandbox, nodeartifact and text-to-sql-demo share. 

Open `demo.html` in a browser to see every component with the markup to copy.

## Use it

Take the three files from a [release](https://github.com/nodestep-ai/nodestep-stylesheet/releases), put them next to your pages and load them in the head:

```html
<head>
  <meta name="color-scheme" content="light dark">
  <script src="nodestep-theme.js"></script>
  <script src="nodestep-data.js"></script>
  <link rel="stylesheet" href="nodestep.css">
  <link rel="stylesheet" href="app.css">
</head>
```

- `nodestep.css`: tokens, the light and dark themes, the app shell and the components.
- `nodestep-theme.js`: the theme button, which stores the choice in the browser, and the search field's clear button.
- `nodestep-data.js`: search, expand and collapse, and copy for the data viewer. Leave it out on pages without one.

Your own styles go in a file loaded after `nodestep.css`, here `app.css`.

## Copies in the apps

The apps keep copies of the files:

- nodestep: all three in `src/nodestep_sandbox/static/`
- nodeartifact: all three in `src/nodeartifact/server/static/`
- text-to-sql-demo: `nodestep.css` in `web/src/nodestep-design/`

Change the files here, then copy them over. Each app's tests compare its copy with this repository when it is cloned next to the app, and fail while they differ. The apps also pin the version from `--nodestep-design-version`.

## Development

The tests need Node.js 22.18 or newer:

```sh
node --test
```

They fail when a class in `nodestep.css` is missing from `demo.html` or has no markup block there, when the stylesheet uses a color that is not a token, or when a token pair misses its contrast target.

## Releases

Add a `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.md`, and set the same version in `--nodestep-design-version` in `nodestep.css` and in the `<h1>` of `demo.html`. When CI passes on `main`, the release workflow tags `vX.Y.Z` and attaches the three files.

## License

MIT. See [LICENSE](LICENSE).
