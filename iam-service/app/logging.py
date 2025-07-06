import structlog


structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso", key="timestamp"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)


def get_logger() -> structlog.BoundLogger:
    """Return a service-bound structlog logger."""
    return structlog.get_logger().bind(service="iam-service")
