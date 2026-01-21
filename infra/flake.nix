{
  description = "monacle runner (Ubuntu systemd) with pinned Node.js 20.20.0";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodeVersion = "20.20.0";
          nodeUrlBySystem = {
            "x86_64-linux" = "https://nodejs.org/download/release/latest-v20.x/node-v${nodeVersion}-linux-x64.tar.xz";
            "aarch64-linux" = "https://nodejs.org/download/release/latest-v20.x/node-v${nodeVersion}-linux-arm64.tar.xz";
          };

          sha256BySystem = {
            "x86_64-linux" = "sha256-T0i1Ks9CEwhEo6delNoOlikAnQnkEBsjBIlcJPP75gk=";
            "aarch64-linux" = "sha256-dSETdUp93fBiKzdAorK+w9uvF5KhhxG1WHHXZETYiSo=";
          };

          nodeTar = pkgs.fetchurl {
            url = nodeUrlBySystem.${system};
            sha256 = sha256BySystem.${system};
          };

          node = pkgs.stdenvNoCC.mkDerivation {
            pname = "nodejs";
            version = nodeVersion;
            src = nodeTar;

            dontConfigure = true;
            dontBuild = true;

            installPhase = ''
              set -euo pipefail
              mkdir -p $out
              tar -xJf $src --strip-components=1 -C $out
            '';
          };

          monacleRun = pkgs.writeShellApplication {
            name = "monacle-run";
            runtimeInputs = [
              pkgs.bash
              pkgs.coreutils
              pkgs.git
              node
            ];
            text = ''
              set -euo pipefail

              REPO_URL="https://github.com/monadimi/monacle.git"
              BRANCH="main"

              APP_DIR="/home/monad/apps/monacle/app"
              CACHE_DIR="/var/cache/monacle"
              NPM_CACHE="$CACHE_DIR/npm"

              PORT=3000
              export NODE_ENV="production"
              export NPM_CONFIG_CACHE="$NPM_CACHE"
              export PORT

              mkdir -p "$APP_DIR" "$NPM_CACHE"

              if [ ! -d "$APP_DIR/.git" ]; then
                git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
              else
                cd "$APP_DIR"
                git fetch origin "$BRANCH" --depth 1
                git reset --hard "origin/$BRANCH"
                git clean -fd
              fi

              cd "$APP_DIR"

              npm ci --include=dev
              NODE_ENV=production npm run build
              NODE_ENV=production exec npm run start
            '';
          };
        in
        {
          nodejs_20_20_0 = node;
          monacle-run = monacleRun;
          default = monacleRun;
        }
      );
    };
}