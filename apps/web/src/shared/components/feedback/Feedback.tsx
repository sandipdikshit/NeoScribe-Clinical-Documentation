'use client'

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Loader2, CheckCircle, MessageSquareShare } from 'lucide-react';
import { useToast } from "@/shared/hooks/use-toast";
import feedbackService from '@/services/feedbackApis';
import { FeedbackType, FeedbackData } from '@/shared/types/feedback.type';

interface FeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string; // Optional patient ID if feedback is related to a patient
  providerId: number; // Current provider ID
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({
  isOpen,
  onClose,
  patientId,
  providerId
}) => {
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({
    subject: '',
    content: '',
    feedbackType: FeedbackType.GENERAL, // Default to general
    rating: null,
    patientId: patientId
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFeedbackData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFeedbackTypeChange = (value: string) => {
    setFeedbackData(prev => ({
      ...prev,
      feedbackType: value as FeedbackType
    }));
  };

  const handleRatingChange = (value: string) => {
    setFeedbackData(prev => ({
      ...prev,
      rating: parseInt(value, 10)
    }));
  };

  const resetForm = () => {
    setFeedbackData({
      subject: '',
      content: '',
      feedbackType: FeedbackType.GENERAL,
      rating: null,
      patientId: patientId
    });
    setSubmitSuccess(false);
  };

  const handleClose = () => {
    onClose();
    // Reset form after a short delay to avoid visual disruption
    setTimeout(resetForm, 300);
  };

  const handleSubmit = async () => {
    // Validate form
    if (!feedbackData.subject.trim()) {
      toast({
        title: "Missing Subject",
        description: "Please provide a subject for your feedback.",
        variant: "destructive",
      });
      return;
    }

    if (!feedbackData.content.trim()) {
      toast({
        title: "Missing Content",
        description: "Please provide details in your feedback.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Prepare payload
      const payload = {
        ...feedbackData,
        providerId
        };
      
      // Log payload for debugging (remove in production)

      
      // Here you would make the actual API call:
      const response = feedbackService.create({
        subject: feedbackData.subject,
        content: feedbackData.content,
        rating: feedbackData.rating,
        feedback_type: feedbackData.feedbackType,
      });
      // 
      
      setSubmitSuccess(true);
      
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback. We appreciate your input!",
        variant: "success",
      });
      
      // Close dialog after showing success state briefly
      setTimeout(() => {
        handleClose();
      }, 1500);
      
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit feedback. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[485px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareShare className="h-5 w-5 text-blue-600" />
            <span>Submit Feedback</span>
          </DialogTitle>
          <DialogDescription>
            We value your input! Please share your thoughts, report issues, or suggest improvements.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subject" className="text-right">
              Subject<span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              name="subject"
              value={feedbackData.subject}
              onChange={handleInputChange}
              className="col-span-3"
              placeholder="Brief summary of your feedback"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="feedbackType" className="text-right">
              Type
            </Label>
            <Select 
              value={feedbackData.feedbackType} 
              onValueChange={handleFeedbackTypeChange}
              disabled={isSubmitting}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select feedback type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FeedbackType.GENERAL}>General</SelectItem>
                <SelectItem value={FeedbackType.BUG}>Bug Report</SelectItem>
                <SelectItem value={FeedbackType.FEATURE_REQUEST}>Feature Request</SelectItem>
                <SelectItem value={FeedbackType.IMPROVEMENT}>Improvement</SelectItem>
                <SelectItem value={FeedbackType.OTHER}>Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rating" className="text-right">
              Rating
            </Label>
            <Select 
              value={feedbackData.rating?.toString() || ''} 
              onValueChange={handleRatingChange}
              disabled={isSubmitting}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="How would you rate it? (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 - Poor</SelectItem>
                <SelectItem value="2">2 - Below Average</SelectItem>
                <SelectItem value="3">3 - Average</SelectItem>
                <SelectItem value="4">4 - Good</SelectItem>
                <SelectItem value="5">5 - Excellent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <Label htmlFor="content" className="text-right pt-2">
              Details<span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="content"
              name="content"
              value={feedbackData.content}
              onChange={handleInputChange}
              className="col-span-3"
              rows={5}
              placeholder="Please provide details about your feedback..."
              disabled={isSubmitting}
            />
          </div>
          
          {patientId && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                Patient
              </Label>
              <div className="col-span-3 text-sm bg-blue-50 text-blue-800 px-3 py-2 rounded-md">
                This feedback is linked to a specific patient record.
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-400 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : submitSuccess ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Submitted!
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackForm;