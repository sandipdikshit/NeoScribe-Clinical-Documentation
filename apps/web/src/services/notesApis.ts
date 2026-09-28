import axios from 'axios';
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
import {postData, getData, deleteData, putData} from '@/lib/api/crud';
import  ENDPOINTS  from '@/config/apiConfig';

function formatDate(date: string) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) 
      month = '0' + month;
  if (day.length < 2) 
      day = '0' + day;

  return [month, day, year].join('-');
}

export const processAudio = async (
  audioFile: Blob,
  chiefComplaint: string,
  selectedPatient: string,
  visitDate: string,
  noteType: string,
  template_id: string
) => {
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('chief_complaint', chiefComplaint);
    formData.append('patient_id', selectedPatient);
    formData.append('visit_date', visitDate);
    formData.append('note_type', noteType);
    formData.append('template_id', template_id);

    const data = await postData(ENDPOINTS.PROCESS_AUDIO, formData);
    return data;
  } catch (error) {
    console.error('Error processing audio:', error);
    throw error;
  }
};

export const analyzeText = async (text: string) => {
  try {
    const formData = new FormData();
    formData.append('text', text);

    const data = await postData(ENDPOINTS.ANALYZE_TEXT, formData);
    return data;
  } catch (error) {
    console.error('Error analyzing text:', error);
    throw error;
  }
};

export const getNotes = async () => {
  try {
    const data = await getData(`${ENDPOINTS.NOTES}/`);
    return data;
  } catch (error) {
    console.error('Error fetching note:', error);
    throw error;
  }
}

export const getNoteWithID = async (id: string) => {
  try {
    const data = await getData(`${ENDPOINTS.NOTES}/${id}`);
    return data;
  } catch (error) {
    console.error('Error fetching note:', error);
    throw error;
  }
}

export const getAudio = async (id: string) => {
  try {
    const data = await getData(`${ENDPOINTS.NOTES}/generate_sas/${id}`);
    return data;
  } catch (error) {
    console.error('Error fetching note:', error);
    throw error;
  }
}
export const deleteNote = async (id: string) => {
  try {
    const data = await deleteData(`${ENDPOINTS.NOTES}/${id}`);
    return data;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
}

export const getSections = async (id: string) => {
  try {
    const data = await getData(`${ENDPOINTS.SECTIONS}/note/${id}`);
    return data;
  } catch (error) {
    console.error('Error fetching note:', error);
    throw error;
  }
}

export const getSection = async (id: string) => {
  try {
    const data = await getData(`${ENDPOINTS.SECTIONS}/${id}`);
    return data;
  } catch (error) {
    console.error('Error fetching note:', error);
    throw error;
  }
}

export const updateSection = async (id: string, updatedSection: {
  content: string;
  section_type: string;
}) => {
  try {
    const data = await putData(`${ENDPOINTS.SECTIONS}/${id}`, updatedSection, "application/json");
    return data;
  } catch (error) {
    console.error('Error fetching note:', error);
    throw error;
  }
}

export const reaction = {
  like: async (id: string) => {
    try {
      const data = await postData(`${ENDPOINTS.SECTIONS}/${id}/like`);
      return data;
    } catch (error) {
      console.error('Error liking note:', error);
      throw error;
    }
  },
  dislike: async (id: string) => {
    try {
      const data = await postData(`${ENDPOINTS.SECTIONS}/${id}/dislike`);
      return data;
    } catch (error) {
      console.error('Error disliking note:', error);
      throw error;
    }
  },
}

export const createSection = async (section: {
  content: string;
  section_type: string;
  section_name: string;
  sequence_number: number;
}) => {
  try {
    const response = await postData(`${ENDPOINTS.SECTIONS}/`, section, "application/json");
    return response;
  } catch (error) {
    console.error("Error creating section:", error);
    throw error;
  }
};
