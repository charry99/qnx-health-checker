/*
 * tempsensor.c — temperature sensor server for QNX SDP 8.0.
 * Exposes /dev/tempsensor as a resource manager; clients ask for the
 * current temperature over QNX native message passing.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <sys/neutrino.h>
#include <sys/dispatch.h>
#include <sys/resmgr.h>

static int read_temperature(void) {
    return 21; /* placeholder: real hardware read goes here */
}

static void *sensor_thread(void *arg) {
    (void)arg;
    int chid = ChannelCreate(0);
    if (chid == -1) {
        perror("ChannelCreate");
        return NULL;
    }
    if (name_attach(NULL, "tempsensor", 0) == NULL) {
        perror("name_attach");
        return NULL;
    }
    for (;;) {
        struct _msg_info info;
        char msg[64];
        int rcvid = MsgReceive(chid, msg, sizeof(msg), &info);
        if (rcvid == -1) continue;
        if (rcvid == 0) continue; /* pulse: ignore */
        int temp = read_temperature();
        MsgReply(rcvid, 0, &temp, sizeof(temp));
    }
}

int main(void) {
    dispatch_t *dpp = dispatch_create();
    if (dpp == NULL) {
        perror("dispatch_create");
        return 1;
    }
    resmgr_attr_t attr;
    memset(&attr, 0, sizeof(attr));
    if (resmgr_attach(dpp, &attr, "/dev/tempsensor", _FTYPE_ANY, 0,
                      RESMGR_FLAG_ATTACH, NULL, NULL) == -1) {
        perror("resmgr_attach");
        return 1;
    }

    /* Real-time sampler thread: FIFO at an explicit priority. */
    pthread_t sampler;
    pthread_attr_t tattr;
    struct sched_param param;
    pthread_attr_init(&tattr);
    pthread_attr_setschedpolicy(&tattr, SCHED_FIFO);
    pthread_attr_setinheritsched(&tattr, PTHREAD_EXPLICIT_SCHED);
    param.sched_priority = 10;
    pthread_attr_setschedparam(&tattr, &param);
    pthread_create(&sampler, &tattr, sensor_thread, NULL);
    pthread_join(sampler, NULL);
    return 0;
}
