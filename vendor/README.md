# Vendor Runtime

`vendor/symphony` is reserved for the optional `openai/symphony` submodule.

Initialize it with:

```sh
git submodule add https://github.com/openai/symphony vendor/symphony
git submodule update --init --recursive
```

Keep Symphony pinned to an explicit commit. VibeRig treats it as a reference runtime, not as plugin source code.
