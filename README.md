# H3 Loading Screen for ElDewrito

A conversion of [Xephorium's WebGL recreation of the Halo 3 loading screen](https://github.com/Xephorium/Halo3LoadingScreen) to function as a map loading screen UI mod for ElDewrito. Tested on ElDewrito 0.7.1 on Windows.

https://github.com/user-attachments/assets/46a777d1-8ff3-4e91-8100-98f9004c6158

## Installation

1. (optional) Make a backup of your ``<gamedir>/ui/screens/loading`` folder in case you want to uninstall the mod some time. Alternatively, you are able to redownload and restore the original versions of modified files using launcher.exe and going to Settings > Files > Verify Files.
2. **Extract the ``ui`` folder from this repository to your ElDewrito installation folder. If you are asked if you want to merge the folder with your existing ``ui`` folder, you must say Yes. You must also say Yes to overwriting files.**
3. (optional) Tweak settings in ``ui/screens/loading/loading-config.json``. Not everything from the original version's URL parameters is available yet. I was primarily focused on map/server info, and tweaking values for the interpolation. I'd like to restore colour scheme options soon.
4. **Start / restart the game.**


> [!IMPORTANT]
> This has only been tested with CEF GPU acceleration enabled. I suspect WebGL is unsupported in software rendering. Not tested at all on Linux or with DXVK.

> [!NOTE]
> A stutter occurs when loading finishes; ElDewrito seems to be activating the map and not presenting CEF frames. Loading being finished occurs before the ring is visibly full: actual progress is interpolated to provide a smoother progress bar. When a load finishes, I let the ring have half a second to animate completion / fade out from its current point. You can see this stutter in the video above, towards the end of the ring completion. I think this is unavoidable, but if you have any proposals or PRs, please share them.

## License

Any original code or modifications by me are licensed CC0, but this does not mean you have a right to redistribute this work as seen. The code in this repository is based on [Xephorium's WebGL recreation of the Halo 3 loading screen](https://github.com/Xephorium/Halo3LoadingScreen) which is offered without a license. This fork relies on the general right to fork granted in the GitHub Terms of Service to other users of public repositories, which does not grant you any right to redistribute this code offsite and does not imply any rights other than to use functionality provided by GitHub. Other libraries in the project include their applicable license terms.

## Credits

- Xephorium for creating the WebGL recreation upon which this is derived. Includes work by:
  - Henry Kang - particle shader
  - Michael Mclaughlin - arbitrary precision maths library (decimal.js)
  - Sean McCullough, Makoto Matsumoto, Takuji Nishimura - pseudo RNG (mersenne-twister.js)
  - kanda and matsuda - matrix maths library (cuon-matrix.js & cuon-utils.js)
- The ElDewrito 0.6 and 0.7 teams for the WebRenderer and their original loading screen implementation.
