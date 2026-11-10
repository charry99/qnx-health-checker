ifndef QCONFIG
QCONFIG=qconfig.mk
endif
include $(QCONFIG)
INSTALLDIR=usr/bin
define PINFO
PINFO DESCRIPTION=Temperature sensor server for QNX 8.0.
endef
NAME=tempsensor
CCFLAGS=-O2 -Wall
CXXFLAGS=-O2 -Wall -std=c++17
include $(MKFILES_ROOT)/qtargets.mk
