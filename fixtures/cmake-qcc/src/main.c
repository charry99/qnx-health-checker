/*
 * main.c — minimal QNX 8.0 client demo (CMake + qcc build).
 */
#include <stdio.h>
#include <sys/neutrino.h>

int main(void) {
#ifdef __QNXNTO__
    int coid = name_open("tempsensor", 0);
    if (coid == -1) {
        perror("name_open");
        return 1;
    }
    char request[] = "temp?";
    int reply = 0;
    if (MsgSend(coid, request, sizeof(request), &reply, sizeof(reply)) == -1) {
        perror("MsgSend");
        return 1;
    }
    printf("temperature: %d C\n", reply);
    return 0;
#else
    printf("not a QNX build\n");
    return 1;
#endif
}
