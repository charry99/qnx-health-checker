/*
 * templog.c — temperature logger. Runs on QNX (we think).
 * Plain POSIX: threads, sockets, printf. Nothing QNX-specific.
 */
#include <stdio.h>
#include <pthread.h>
#include <sys/socket.h>

static void *logger_thread(void *arg) {
    (void)arg;
    for (;;) {
        printf("temp: 21 C\n");
        sleep(1);
    }
    return NULL;
}

int main(void) {
    pthread_t logger;
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    /* Real-time logging thread. */
    pthread_attr_setschedpolicy(&attr, SCHED_FIFO);
    pthread_create(&logger, &attr, logger_thread, NULL);
    pthread_join(logger, NULL);
    return 0;
}
