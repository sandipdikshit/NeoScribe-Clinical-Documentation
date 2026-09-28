import pandas as pd
from openpyxl import Workbook
from ...middlewares.analyze import analyze_document
import json

def analyze_text(text):
    result = analyze_document([text])
    return result[0].to_dict() if result else None

def process_csv(input_csv_path, output_excel_path):
    df = pd.read_csv(input_csv_path)
    workbook = Workbook()
    workbook.remove(workbook.active)  # Remove the default sheet

    for index, row in df.iterrows():
        document_id = str(index)
        text = row["text"]

        analysis_result = analyze_text(text)

        # Create a new sheet for each document
        sheet = workbook.create_sheet(title=document_id)

        # Write text in the first row
        sheet.append(["Text"])
        sheet.append([text])

        # Write abstract summary in the next row
        sheet.append(["Abstract Summary"])
        for summary in analysis_result["abstract_summary"]:
            sheet.append([summary])

        # Write entity relations table
        sheet.append(["Entity Relations"])
        sheet.append(["Relation Type", "Entities"])
        for relation in analysis_result["entity_relations"]:
            entities_str = ", ".join([f"{role['role']}: {role['entity']}" for role in relation["entities"]])
            sheet.append([relation["relation_type"], entities_str])

        # Write healthcare entities table
        sheet.append(["Healthcare Entities"])
        sheet.append(["Text", "Category", "Data Sources", "Confidence Score"])
        for entity in analysis_result["healthcare_entities"]:
            data_sources_str = ", ".join(entity["data_sources"]) if entity["data_sources"] else "None"
            sheet.append([entity["text"], entity["category"], data_sources_str, entity["confidence_score"]])

    # Save the workbook to the specified path
    try:
        workbook.save(output_excel_path)
        print(f"Excel file created at {output_excel_path}")
    except PermissionError:
        print(f"Permission denied: Unable to save the file at {output_excel_path}. Please close the file if it is open and try again.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    input_csv_path = r'"C:\Users\shiva\Downloads\response.json"'  # Replace with the path to your input CSV file
    output_excel_path = r'"C:\Users\shiva\Downloads\res\res.xlsx"'  # Replace with the desired output Excel file path

    process_csv(input_csv_path, output_excel_path)
    print(f"Excel file created at {output_excel_path}")