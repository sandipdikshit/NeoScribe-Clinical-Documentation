import json
import pandas as pd

def json_to_csv(json_file_path, csv_file_path):
	# Read the JSON file
	with open(json_file_path, 'r', encoding='utf-8') as file:
		data = json.load(file)
	
	# Prepare data for DataFrame
	rows = []
	for document in data:
		healthcare_entities = document.get('healthcare_entities', [])
		for entity in healthcare_entities:
			row = {
				'text': entity.get('text', ''),
				'category': entity.get('category', ''),
				'subcategory': entity.get('subcategory', ''),
				'confidence_score': entity.get('confidence_score', 0.0)
			}
			rows.append(row)
	
	# Create DataFrame
	df = pd.DataFrame(rows, columns=['text', 'category', 'subcategory', 'confidence_score'])
	
	# Save DataFrame to CSV
	df.to_csv(csv_file_path, index=False)

if __name__ == "__main__":
	json_file_path = "../tests/Outputs/document-1_output.json"  # Replace with the path to your JSON file
	csv_file_path = "../tests/Outputs/output.csv"  # Replace with the desired output CSV file path
	
	json_to_csv(json_file_path, csv_file_path)
	print(f"CSV file created at {csv_file_path}")