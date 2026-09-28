#!/usr/bin/env python3
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
import time
import logging

# Enable DEBUG logging
logging.basicConfig(level=logging.DEBUG)

# Create a resource with your service name
resource = Resource.create({SERVICE_NAME: "test-service"})

# Create a tracer provider
tracer_provider = TracerProvider(resource=resource)

print("Creating OTLP exporter to endpoint: http://localhost:4317")
otlp_exporter = OTLPSpanExporter(
    endpoint="http://localhost:4317",
    insecure=True,  # Disable TLS
)

# Add the exporter to the tracer provider
print("Adding BatchSpanProcessor")
span_processor = BatchSpanProcessor(otlp_exporter)
tracer_provider.add_span_processor(span_processor)

# Set the tracer provider
trace.set_tracer_provider(tracer_provider)

# Get a tracer
tracer = trace.get_tracer(__name__)

# Create and export spans
print("Creating test spans")
for i in range(20):  # Create enough spans to trigger a batch export
    with tracer.start_as_current_span(f"test-span-{i}"):
        print(f"Processing span {i}")
        time.sleep(0.5)

print("Waiting for export to complete...")
time.sleep(15)  # Wait to ensure the batch is exported
print("Test completed")