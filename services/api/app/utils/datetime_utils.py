import datetime


def parse_datetime(date_input, primary_format='%m-%d-%Y'):
    if isinstance(date_input, datetime.datetime):
        return date_input
    
    formats_to_try = [
        primary_format,
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%S.%f',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%d',
        '%m-%d-%Y',
    ]
    
    for fmt in formats_to_try:
        try:
            return datetime.datetime.strptime(date_input, fmt)
        except ValueError:
            continue
    
    # Try fromisoformat as fallback
    try:
        return datetime.datetime.fromisoformat(date_input)
    except ValueError:
        raise ValueError(f"Could not parse date: {date_input}")
