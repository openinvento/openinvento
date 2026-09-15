import logging
import os


class ColorFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[1;31m",
    }

    RESET = "\033[0m"

    def format(self, record):
        if os.getenv("NO_COLOR") is None:
            levelname = (
                f"{self.COLORS.get(record.levelname, '')}"
                f"{record.levelname}"
                f"{self.RESET}"
            )
        else:
            levelname = record.levelname

        return (
            f"{self.formatTime(record, self.datefmt)}"
            f" | {levelname:<17}"
            f" | {record.name}"
            f" | {record.getMessage()}"
        )

def configure_early_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(
        ColorFormatter(
            "{asctime} | {levelname:<8} | {name} | {message}",
            style="{",
            datefmt="%H:%M:%S",
        )
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(handler)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,

    "formatters": {
        "console": {
            "()": "openinvento.custom_logger.ColorFormatter",
            "datefmt": "%H:%M:%S",
        },
    },

    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "console",
        },
    },

    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}