# tempsensor

A temperature sensor server for QNX SDP 8.0. It exposes `/dev/tempsensor`
as a resource manager and answers client requests over QNX native message
passing (`ChannelCreate` / `MsgSend`).

## Target

Runs on QEMU (x86_64) and aarch64 hardware.

## Toolchain

Built with qcc (GCC 12) from the QNX SDP 8.0 toolchain.

## Build

```sh
source ~/qnx800/qnxsdp-env.sh
make
mkifs tempsensor.build tempsensor.ifs
```
