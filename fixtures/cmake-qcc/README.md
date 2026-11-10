# qnxdemo

A minimal QNX 8.0 client demo, built with CMake.

## Target

Runs on QEMU (x86_64).

## Build

```sh
source ~/qnx800/qnxsdp-env.sh
cmake -B build -DCMAKE_TOOLCHAIN_FILE=cmake/qnx-toolchain.cmake
cmake --build build
```
