# QNX 8.0 toolchain file for CMake.
# Use the qcc compiler wrapper from the QNX SDP 8.0 toolchain.
set(CMAKE_SYSTEM_NAME QNX)
set(CMAKE_SYSTEM_PROCESSOR x86_64)
set(CMAKE_C_COMPILER qcc)
set(CMAKE_CXX_COMPILER q++)
set(CMAKE_C_COMPILER_TARGET gcc_ntox86_64)
set(QNX_TARGET $ENV{QNX_TARGET})
