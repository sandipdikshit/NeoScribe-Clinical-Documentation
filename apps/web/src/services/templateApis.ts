import {postData, getData, deleteData, putData} from '@/lib/api/crud';
import ENDPOINTS from '@/config/apiConfig';

export const getTemplates = async()=>{
    try {
      const data = await getData(`${ENDPOINTS.TEMPLATES}/`);
      return data;
    } catch (error) {
      console.error('Error fetching note:', error);
      throw error;
    }
}

export const getTemplate = async(id:string)=>{
  try {
    const data = await getData(`${ENDPOINTS.TEMPLATES}/${id}`);
    return data;
  } catch (error) {
    console.error('Error fetching note:', error);
    throw error;
  }
}

export const createTemplate = async (templateData: any) => {
  try {
    const data = await postData(`${ENDPOINTS.TEMPLATES}/`, templateData, 'application/json');
      return data;
    } catch (error) {
      console.error('Error creating Template:', error);
      throw error;
    }
};

export const updateTemplate = async (templateId: string, templateData: any) => {
  try {
    const data = await putData(`${ENDPOINTS.TEMPLATES}/${templateId}`, templateData, 'application/json');
    return data;
  } catch (error) {
    console.error('Error creating Template:', error);
    throw error;
  }
};
  
export const deleteTemplate = async (templateId: string) => {
    try {
      const data = await deleteData(`${ENDPOINTS.TEMPLATES}/${templateId}`);
      return data;
    } catch (error) {
      console.error('Error deleting Template:', error);
      throw error;
    }
}