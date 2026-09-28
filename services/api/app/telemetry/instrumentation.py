"""
Enhanced OpenTelemetry instrumentation for FastAPI with SigNoz Free.

This module provides core observability features with comprehensive infrastructure metrics:
- Distributed tracing for all requests
- Basic metrics (HTTP requests, duration)
- Log forwarding with trace context
- Error tracking
- Comprehensive system metrics (CPU, memory, disk, network, etc.)

Designed for OpenTelemetry 1.22.0 with SigNoz Free version.
"""

import logging
import socket
import time
import asyncio
import psutil
import platform
import os
import sys
from typing import Dict, Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from opentelemetry import trace, metrics
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

# Log export
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter


def instrument_app(
   app: FastAPI,
   service_name: str,
   otlp_endpoint: str = "http://localhost:4317",
   log_level: int = logging.INFO,
   enable_metrics: bool = True,
   enable_logs: bool = True,
   enable_system_metrics: bool = True,
   metrics_interval_seconds: int = 5,  # Changed to 5 seconds for more frequent updates
   resource_attributes: Optional[Dict[str, str]] = None,
   environment: str = "production",
   excluded_urls: Optional[List[str]] = None,
) -> FastAPI:
   """
   Instrument a FastAPI application with OpenTelemetry for SigNoz.
   
   Args:
       app: The FastAPI application to instrument
       service_name: Name of the service
       otlp_endpoint: Endpoint for the OpenTelemetry collector
       log_level: Logging level
       enable_metrics: Whether to enable metrics collection
       enable_logs: Whether to enable log forwarding
       enable_system_metrics: Whether to enable system metrics
       metrics_interval_seconds: Interval for metrics collection in seconds
       resource_attributes: Additional resource attributes
       environment: Deployment environment
       excluded_urls: List of URL patterns to exclude from tracing
       
   Returns:
       The instrumented FastAPI application
   """
   # Set up basic logging
   logging.basicConfig(
       level=log_level,
       format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
   )
   
   logging.info(f"Initializing OpenTelemetry for service: {service_name}")
   logging.info(f"OTLP endpoint: {otlp_endpoint}")
   
   # Get hostname and process info
   hostname = socket.gethostname()
   pid = os.getpid()
   
   # Create resource with service information
   base_attributes = {
       SERVICE_NAME: service_name,
       "service.environment": environment,
       "host.name": hostname,
       "host.id": hostname,  # Explicit host identifier
       "process.pid": str(pid),
       "telemetry.sdk.name": "opentelemetry",
       "telemetry.sdk.language": "python",
       "telemetry.sdk.version": "1.22.0",
   }
   
   # Add any additional attributes
   if resource_attributes:
       base_attributes.update(resource_attributes)
   
   resource = Resource.create(base_attributes)
   
   # Set up tracing
   logging.info("Setting up trace provider")
   tracer_provider = TracerProvider(resource=resource)
   
   otlp_span_exporter = OTLPSpanExporter(
       endpoint=otlp_endpoint,
       insecure=True
   )
   
   span_processor = BatchSpanProcessor(
       otlp_span_exporter,
       max_export_batch_size=512,
       schedule_delay_millis=5000
   )
   
   tracer_provider.add_span_processor(span_processor)
   trace.set_tracer_provider(tracer_provider)
   
   # Set up metrics
   if enable_metrics:
       logging.info("Setting up metrics")
       
       otlp_metric_exporter = OTLPMetricExporter(
           endpoint=otlp_endpoint,
           insecure=True
       )
       
       metric_reader = PeriodicExportingMetricReader(
           otlp_metric_exporter,
           export_interval_millis=metrics_interval_seconds * 1000
       )
       
       meter_provider = MeterProvider(
           resource=resource,
           metric_readers=[metric_reader]
       )
       metrics.set_meter_provider(meter_provider)
       
       # Create a meter
       meter = metrics.get_meter(f"{service_name}.metrics")
       
       # Create HTTP request metrics
       http_request_counter = meter.create_counter(
           name="http.request.count",
           description="Number of HTTP requests",
           unit="1"
       )
       
       http_request_duration = meter.create_histogram(
           name="http.request.duration",
           description="Duration of HTTP requests",
           unit="ms"
       )
       
       http_request_size = meter.create_histogram(
           name="http.request.size",
           description="Size of HTTP requests",
           unit="bytes"
       )
       
       http_response_size = meter.create_histogram(
           name="http.response.size",
           description="Size of HTTP responses",
           unit="bytes"
       )
       
       error_counter = meter.create_counter(
           name="error.count",
           description="Number of errors",
           unit="1"
       )
   
   # Set up logging
   if enable_logs:
       logging.info("Setting up log export")
       
       logger_provider = LoggerProvider(resource=resource)
       
       otlp_log_exporter = OTLPLogExporter(
           endpoint=otlp_endpoint,
           insecure=True
       )
       
       logger_provider.add_log_record_processor(
           BatchLogRecordProcessor(otlp_log_exporter)
       )
       
       # Add handler to root logger
       handler = LoggingHandler(level=log_level, logger_provider=logger_provider)
       root_logger = logging.getLogger()
       root_logger.addHandler(handler)
       
       # Instrument Python logging
       LoggingInstrumentor().instrument(set_logging_format=True)
   
   # Instrument FastAPI
   logging.info("Instrumenting FastAPI")
   FastAPIInstrumentor.instrument_app(
       app, 
       excluded_urls=excluded_urls or []
   )
   
   # Instrument other libraries
   logging.info("Instrumenting requests library")
   RequestsInstrumentor().instrument()
   
   # Add middleware for request metrics and error tracking
   @app.middleware("http")
   async def telemetry_middleware(request: Request, call_next):
       # Track request start time
       start_time = time.time()
       
       # Get current span
       span = trace.get_current_span()
       trace_id = "unknown"
       span_id = "unknown"
       
       if span.is_recording():
           ctx = span.get_span_context()
           trace_id = format(ctx.trace_id, '032x')
           span_id = format(ctx.span_id, '016x')
           request.state.trace_id = trace_id
           request.state.span_id = span_id
       
       # Add request details to span
       client_ip = request.client.host if request.client else "unknown"
       user_agent = request.headers.get("User-Agent", "unknown")
       span.set_attribute("http.client_ip", client_ip)
       span.set_attribute("http.user_agent", user_agent)
       
       # Try to get request content length
       request_size = int(request.headers.get("Content-Length", 0))
       if request_size > 0 and enable_metrics:
           http_request_size.record(
               request_size, 
               {
                   "http.method": request.method,
                   "http.route": request.url.path
               }
           )
       
       # Process the request
       try:
           response = await call_next(request)
           status_code = response.status_code
       except Exception as exc:
           # Track errors
           if enable_metrics:
               error_counter.add(
                   1, 
                   {
                       "error.type": exc.__class__.__name__,
                       "http.method": request.method,
                       "http.route": request.url.path
                   }
               )
           
           logging.exception(
               f"Request failed: {str(exc)}",
               extra={
                   "trace_id": trace_id,
                   "span_id": span_id,
                   "http.method": request.method,
                   "http.url": str(request.url),
                   "error.type": exc.__class__.__name__,
                   "error.message": str(exc)
               }
           )
           raise
       
       # Calculate duration
       duration_ms = (time.time() - start_time) * 1000
       
       # Record metrics if enabled
       if enable_metrics:
           # Request attributes
           attributes = {
               "http.method": request.method,
               "http.route": request.url.path,
               "http.status_code": status_code,
               "http.status_class": f"{status_code // 100}xx"
           }
           
           # Record request count
           http_request_counter.add(1, attributes)
           
           # Record request duration
           http_request_duration.record(duration_ms, attributes)
           
           # Try to get response content length
           response_size = int(response.headers.get("Content-Length", 0))
           if response_size > 0:
               http_response_size.record(
                   response_size, 
                   {
                       "http.method": request.method,
                       "http.route": request.url.path,
                       "http.status_code": status_code
                   }
               )
       
       # Log request completion
       logging.info(
           f"Request: {request.method} {request.url.path} - {status_code} - {duration_ms:.2f}ms",
           extra={
               "trace_id": trace_id,
               "span_id": span_id,
               "http.method": request.method,
               "http.url": str(request.url),
               "http.status_code": status_code,
               "duration_ms": duration_ms
           }
       )
       
       # Add trace ID to response headers
       response.headers["X-Trace-ID"] = trace_id
       
       return response
   
   # Add exception handler
   @app.exception_handler(Exception)
   async def global_exception_handler(request: Request, exc: Exception):
       from fastapi.responses import JSONResponse
       import traceback
       
       # Get trace context
       trace_id = getattr(request.state, "trace_id", "unknown")
       
       # Log the exception with trace context
       logging.error(
           f"Unhandled exception: {str(exc)}",
           extra={
               "trace_id": trace_id,
               "error.type": exc.__class__.__name__,
               "error.message": str(exc),
               "error.stacktrace": traceback.format_exc(),
               "http.method": request.method,
               "http.url": str(request.url)
           }
       )
       
       # Return a JSON response
       return JSONResponse(
           status_code=500,
           content={
               "detail": "Internal server error", 
               "trace_id": trace_id
           }
       )
   
   # Add system metrics collection if enabled
   if enable_metrics and enable_system_metrics:
       # Store the original lifespan if it exists
       original_lifespan = getattr(app, "lifespan", None)
       
       @asynccontextmanager
       async def metrics_lifespan(app: FastAPI):
           logging.info("Starting infrastructure metrics collection")
           
           # Create standard metrics compatible with SigNoz infrastructure view
           # Node metrics (for infrastructure monitoring)
           node_cpu_seconds = meter.create_counter(
               name="node_cpu_seconds_total",
               description="Seconds the CPUs spent in each mode",
               unit="seconds"
           )
           
           node_memory_bytes = meter.create_gauge(
               name="node_memory_MemTotal_bytes",
               description="Memory information: MemTotal",
               unit="bytes"
           )
           
           node_memory_free_bytes = meter.create_gauge(
               name="node_memory_MemFree_bytes",
               description="Memory information: MemFree",
               unit="bytes"
           )
           
           node_memory_available_bytes = meter.create_gauge(
               name="node_memory_MemAvailable_bytes",
               description="Memory information: MemAvailable",
               unit="bytes"
           )
           
           node_disk_bytes = meter.create_gauge(
               name="node_filesystem_size_bytes",
               description="Filesystem size in bytes",
               unit="bytes"
           )
           
           node_disk_free_bytes = meter.create_gauge(
               name="node_filesystem_free_bytes",
               description="Filesystem free space in bytes",
               unit="bytes"
           )
           
           node_network_receive_bytes = meter.create_counter(
               name="node_network_receive_bytes_total",
               description="Network device statistic receive_bytes",
               unit="bytes"
           )
           
           node_network_transmit_bytes = meter.create_counter(
               name="node_network_transmit_bytes_total",
               description="Network device statistic transmit_bytes",
               unit="bytes"
           )
           
           # Store last network values for delta calculation
           last_net_io = {
               "bytes_recv": 0,
               "bytes_sent": 0,
           }
           
           # Store last CPU times for delta calculation
           last_cpu_times = psutil.cpu_times()
           
           async def collect_system_metrics():
               nonlocal last_cpu_times, last_net_io
               
               while True:
                   try:
                       # CPU metrics
                       current_cpu_times = psutil.cpu_times()
                       
                       # Calculate delta times for each CPU mode
                       user_delta = current_cpu_times.user - last_cpu_times.user
                       system_delta = current_cpu_times.system - last_cpu_times.system
                       idle_delta = current_cpu_times.idle - last_cpu_times.idle
                       
                       # Only record positive deltas
                       if user_delta > 0:
                           node_cpu_seconds.add(user_delta, {"host": hostname, "mode": "user"})
                       if system_delta > 0:
                           node_cpu_seconds.add(system_delta, {"host": hostname, "mode": "system"})
                       if idle_delta > 0:
                           node_cpu_seconds.add(idle_delta, {"host": hostname, "mode": "idle"})
                           
                       # Update last CPU times
                       last_cpu_times = current_cpu_times
                       
                       # Memory metrics
                       memory = psutil.virtual_memory()
                       node_memory_bytes.set(memory.total, {"host": hostname})
                       node_memory_free_bytes.set(memory.free, {"host": hostname})
                       node_memory_available_bytes.set(memory.available, {"host": hostname})
                       
                       # Disk metrics
                       for partition in psutil.disk_partitions(all=False):
                           try:
                               if not partition.mountpoint:
                                   continue
                                   
                               usage = psutil.disk_usage(partition.mountpoint)
                               mountpoint = partition.mountpoint
                               fstype = partition.fstype
                               
                               # Labels for this partition
                               labels = {
                                   "host": hostname,
                                   "device": partition.device,
                                   "mountpoint": mountpoint,
                                   "fstype": fstype
                               }
                               
                               # Record filesystem size and free space
                               node_disk_bytes.set(usage.total, labels)
                               node_disk_free_bytes.set(usage.free, labels)
                           except (PermissionError, OSError):
                               pass
                       
                       # Network metrics
                       try:
                           net_io = psutil.net_io_counters()
                           
                           # Calculate deltas
                           bytes_recv_delta = net_io.bytes_recv - last_net_io["bytes_recv"]
                           bytes_sent_delta = net_io.bytes_sent - last_net_io["bytes_sent"]
                           
                           # Update last values
                           last_net_io["bytes_recv"] = net_io.bytes_recv
                           last_net_io["bytes_sent"] = net_io.bytes_sent
                           
                           # Record positive deltas
                           if bytes_recv_delta > 0:
                               node_network_receive_bytes.add(bytes_recv_delta, {"host": hostname, "device": "all"})
                           if bytes_sent_delta > 0:
                               node_network_transmit_bytes.add(bytes_sent_delta, {"host": hostname, "device": "all"})
                       except (AttributeError, OSError):
                           pass
                       
                       logging.debug("Collected system metrics successfully")
                   except Exception as e:
                       logging.warning(f"Failed to collect system metrics: {str(e)}")
                   
                   # Wait for next collection
                   await asyncio.sleep(metrics_interval_seconds)
           
           # Start the metrics collection task
           task = asyncio.create_task(collect_system_metrics())
           
           # Run the original lifespan if it exists
           if original_lifespan:
               async with original_lifespan(app):
                   yield
           else:
               # Otherwise just yield control
               yield
           
           # Clean up
           task.cancel()
           try:
               await task
           except asyncio.CancelledError:
               logging.info("Metrics collection task cancelled")
       
       # Set our combined lifespan
       app.lifespan = metrics_lifespan
   
   # Add test endpoint
   @app.get("/_otel/test")
   async def test_telemetry():
       """Test endpoint to verify telemetry is working."""
       tracer = trace.get_tracer("test-tracer")
       
       with tracer.start_as_current_span("test-span") as span:
           span.set_attribute("test.attribute", "test-value")
           trace_id = format(span.get_span_context().trace_id, '032x')
           
           # Generate logs at different levels
           logging.debug("Test debug message", extra={"trace_id": trace_id, "test": "true"})
           logging.info("Test info message", extra={"trace_id": trace_id, "test": "true"})
           logging.warning("Test warning message", extra={"trace_id": trace_id, "test": "true"})
           logging.error("Test error message", extra={"trace_id": trace_id, "test": "true"})
           
           # Simulate some work
           time.sleep(0.1)
       
       return {
           "status": "success",
           "message": "Telemetry test complete",
           "trace_id": trace_id
       }
   
   logging.info(f"OpenTelemetry instrumentation complete for service '{service_name}'")
   return app