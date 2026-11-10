cmake_minimum_required(VERSION 3.20)
project(qnxdemo C)

# Target QNX 8.0 using the qcc toolchain (see cmake/qnx-toolchain.cmake).
set(CMAKE_SYSTEM_NAME QNX)
set(CMAKE_TOOLCHAIN_FILE ${CMAKE_SOURCE_DIR}/cmake/qnx-toolchain.cmake)

add_executable(qnxdemo src/main.c)
