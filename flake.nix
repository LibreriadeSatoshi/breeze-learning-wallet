{
  description = "Etta Wallet Web - Next.js Bitcoin/Lightning Wallet";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            yarn
            git
          ];

          shellHook = ''
            echo "Etta Wallet Web Development Environment"
            echo "Node version: $(node --version)"
            echo "Yarn version: $(yarn --version)"
            echo ""
            echo "Run 'yarn install' to install dependencies"
            echo "Run 'yarn dev' to start the development server"
          '';
        };
      }
    );
}
