# H3 Loading Screen for ElDewrito

A conversion of [Xephorium's WebGL recreation of the Halo 3 loading screen](github.com/Xephorium/Halo3LoadingScreen) to function as a loading screen UI mod for ElDewrito 0.7.1 (the latest version at time of writing).

https://github.com/user-attachments/assets/46a777d1-8ff3-4e91-8100-98f9004c6158

> [!IMPORTANT]
> This will likely only work if CEF GPU acceleration is enabled. Not tested on Linux or with DXVK.

> [!NOTE]
> A stutter occurs towards the end of the load cycle since the game tries to hide the loading screen as soon as 100% is hit. I wanted to keep it present to make the end less abrupt, which results in this freeze and continue behaviour as seen in the video. If anyone has an alternative solution, I'd love to hear it.

## License

Any original code or modifications by me are licensed CC0, but this does not mean you have a right to redistribute this work as seen. The code in this repository is based on [Xephorium's WebGL recreation of the Halo 3 loading screen](https://github.com/Xephorium/Halo3LoadingScreen) which is offered without a license. This fork relies on the general right to fork granted in the GitHub Terms of Service to other users of public repositories, which does not permit redistribution offsite and does not imply any rights other than to use functionality provided by GitHub. Other libraries in the project may be offered under their own terms.

## Credits

- Xephorium for creating the WebGL recreation upon which this is derived. Includes work by:
  - Henry Kang - particle shader
  - ibiblio - demonstration of De Casteljau's bezier spline algorithm
  - Michael Mclaughlin - arbitrary precision maths library (decimal.js)
  - Sean McCullough, Makoto Matsumoto, Takuji Nishimura - pseudo RNG (mersenne-twister.js)
  - kanda and matsuda - matrix maths library (cuon-matrix.js & cuon-utils.js)
- The ElDewrito 0.6 and 0.7 teams for the WebRenderer and their original loading screen implementation.
