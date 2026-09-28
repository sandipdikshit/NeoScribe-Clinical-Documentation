import { deleteData, putData } from "@/lib/api/crud";
import {
     securePostData,
     secureGetData,
     securePutData,
} from "@/lib/api/secure-crud";
import ENDPOINTS from "@/config/apiConfig";

export const getPatients = async () => {
     try {
          const response = await secureGetData({
               endpoint: `${ENDPOINTS.PATIENTS}/`,
               encrypt_response: true,
          });
          return response;
     } catch (error) {
          console.error("Error fetching note:", error);
          throw error;
     }
};

export const getPatient = async (id: string) => {
     try {
          const response = await secureGetData({
               endpoint: `${ENDPOINTS.PATIENTS}/${id}`,
               encrypt_response: true,
          });

          return response;
     } catch (error) {
          console.error("Error fetching note:", error);
          throw error;
     }
};

export const createPatient = async (patientData: {
     first_name: string;
     last_name: string;
     date_of_birth: string;
     gender: string;
}) => {
     try {
          const response = await securePostData({
               endpoint: `${ENDPOINTS.PATIENTS}/`,
               data: patientData,
               content: "application/json",
               encrypt_request: true,
               encrypt_response: true,
          });
          return response.data;
     } catch (error) {
          console.error("Error creating patient:", error);
          throw error;
     }
};

export const updatePatient = async (
     patientData: {
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender: string;
     },
     id: string
) => {
     try {
          const data = await securePutData({
               endpoint: `${ENDPOINTS.PATIENTS}/${id}`,
               data: patientData,
               content: "application/json",
               encrypt_request: true,
               encrypt_response: true,
          });

          return data;
     } catch (error) {
          console.error("Error creating patient:", error);
          throw error;
     }
};

export const deletePatient = async (patientId: string) => {
     try {
          const data = await deleteData(`${ENDPOINTS.PATIENTS}/${patientId}`);
          return data;
     } catch (error) {
          console.error("Error deleting patient:", error);
          throw error;
     }
};
