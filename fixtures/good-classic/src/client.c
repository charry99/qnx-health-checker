/*
 * client.c — tiny client for the tempsensor server (QNX SDP 8.0).
 * Looks the server up by name instead of hardcoding a channel id.
 */
#include <stdio.h>
#include <sys/neutrino.h>

int main(void) {
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
#ifdef __QNXNTO__
    printf("temperature: %d C (QNX)\n", reply);
#else
    printf("temperature: %d C\n", reply);
#endif
    return 0;
}
