{
  description = "readthezero - Modern Org-mode HTML export theme";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: nixpkgs.legacyPackages.${system};
      version = "0.1.0";
      themes = [
        "default"
        "ocean"
        "forest"
      ];
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;

          buildTheme =
            name:
            pkgs.stdenv.mkDerivation {
              pname = "readthezero-${name}";
              inherit version;
              src = ./src;

              nativeBuildInputs = [ pkgs.lightningcss ];

              buildPhase = ''
                runHook preBuild

                mkdir -p out

                # Bundle and minify base CSS
                lightningcss --minify --bundle \
                  --targets '>= 0.25%' \
                  base/index.css -o out/readthezero-base.css

                # Bundle and minify theme CSS
                lightningcss --minify --bundle \
                  --targets '>= 0.25%' \
                  themes/${name}.css -o out/readthezero-theme-${name}.css

                # Copy JS
                cp js/readthezero.js out/readthezero.js

                # Generate setup file from template
                cp setup/readthezero.setup.template out/readthezero-${name}.setup
                substituteInPlace out/readthezero-${name}.setup \
                  --replace-fail '@THEME@' '${name}' \
                  --replace-fail '@VERSION@' '${version}'

                runHook postBuild
              '';

              installPhase = ''
                runHook preInstall
                mkdir -p $out
                cp out/* $out/
                runHook postInstall
              '';
            };

          allThemes = pkgs.symlinkJoin {
            name = "readthezero-all-${version}";
            paths = map buildTheme themes;
          };

          emacs = pkgs.emacs-nox;

          buildExample =
            name:
            let
              theme = buildTheme name;
            in
            pkgs.stdenv.mkDerivation {
              pname = "readthezero-example-${name}";
              inherit version;
              src = ./example;

              nativeBuildInputs = [ emacs ];

              buildPhase = ''
                runHook preBuild

                mkdir -p out

                # Export each .org file to HTML
                for orgfile in *.org; do
                  [ -f "$orgfile" ] || continue
                  echo "Exporting $orgfile ..."
                  emacs --batch \
                    --eval "(require 'org)" \
                    --eval "(setq org-html-doctype \"html5\")" \
                    --eval "(setq org-html-html5-fancy t)" \
                    --eval "(setq org-html-head-include-default-style nil)" \
                    --eval "(setq org-html-head \"
                      <meta name=\\\"viewport\\\" content=\\\"width=device-width, initial-scale=1\\\">
                      <link rel=\\\"stylesheet\\\" type=\\\"text/css\\\" href=\\\"assets/readthezero-base.css\\\">
                      <link rel=\\\"stylesheet\\\" type=\\\"text/css\\\" href=\\\"assets/readthezero-theme-${name}.css\\\">
                      <script defer src=\\\"assets/readthezero.js\\\"></script>
                    \")" \
                    --visit "$orgfile" \
                    --funcall org-html-export-to-html
                done

                mv *.html out/ 2>/dev/null || true

                runHook postBuild
              '';

              installPhase = ''
                runHook preInstall

                mkdir -p $out/assets
                cp out/*.html $out/
                cp ${theme}/readthezero-base.css $out/assets/
                cp ${theme}/readthezero-theme-${name}.css $out/assets/
                cp ${theme}/readthezero.js $out/assets/

                runHook postInstall
              '';
            };

          site = pkgs.stdenv.mkDerivation {
            pname = "readthezero-site";
            inherit version;
            src = ./.;
            dontBuild = true;
            installPhase = ''
              mkdir -p $out
              ${builtins.concatStringsSep "\n" (
                map (name: ''
                  mkdir -p $out/${name}
                  cp -r ${buildExample name}/* $out/${name}/
                '') themes
              )}

              # Root index page with theme links
              cp ${./src/site/index.html} $out/index.html
              chmod +w $out/index.html
              substituteInPlace $out/index.html --replace-fail '@VERSION@' '${version}'
            '';
          };

          serve = pkgs.writeShellScriptBin "readthezero-serve" ''
            set -euo pipefail
            SITE=$(nix build .#site --no-link --print-out-paths 2>/dev/null)
            PORT=''${1:-8080}
            echo "Serving readthezero at http://localhost:$PORT"
            echo "  Default: http://localhost:$PORT/default/index.html"
            echo "  Ocean:   http://localhost:$PORT/ocean/index.html"
            echo "  Forest:  http://localhost:$PORT/forest/index.html"
            echo ""
            ${pkgs.python3}/bin/python3 -m http.server "$PORT" --directory "$SITE"
          '';
        in
        {
          default = buildTheme "default";
          all = allThemes;
          example = buildExample "default";
          inherit site serve;
        }
        // builtins.listToAttrs (
          map (name: {
            inherit name;
            value = buildTheme name;
          }) themes
        )
        // builtins.listToAttrs (
          map (name: {
            name = "example-${name}";
            value = buildExample name;
          }) themes
        )
      );

      apps = forAllSystems (
        system: {
          serve = {
            type = "app";
            program = "${self.packages.${system}.serve}/bin/readthezero-serve";
          };
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          build = self.packages.${system}.all;

          example = self.packages.${system}.example;

          lint = pkgs.runCommand "readthezero-lint" { nativeBuildInputs = [ pkgs.lightningcss ]; } ''
            cd ${./src}
            # Validate that all CSS files parse correctly
            for f in base/*.css; do
              echo "Checking $f ..."
              lightningcss --targets '>= 0.25%' "$f" > /dev/null
            done
            for f in themes/default.css themes/ocean.css themes/forest.css; do
              echo "Checking $f ..."
              lightningcss --targets '>= 0.25%' "$f" > /dev/null
            done
            echo "All CSS files valid."
            touch $out
          '';
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          emacs = pkgs.emacs-nox;
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.lightningcss
              emacs
            ];
            shellHook = ''
              cat <<'USAGE_EOF'

=== readthezero Development Shell ===

Build:
  nix build .#default         # Build default theme
  nix build .#ocean           # Build ocean theme
  nix build .#forest          # Build forest theme
  nix build .#all             # Build all themes

Example:
  nix build .#example         # Export example with default theme
  nix build .#example-ocean   # Export example with ocean theme
  nix build .#example-forest  # Export example with forest theme
  nix build .#site            # Build full example site (all themes)

Preview:
  nix run .#serve             # Build site + serve at http://localhost:8080
  nix run .#serve -- 3000     # Serve on custom port

Check:
  nix flake check             # Run all checks (build + lint + example)

USAGE_EOF
            '';
          };
        }
      );
    };
}
