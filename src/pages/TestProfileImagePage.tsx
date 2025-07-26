import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ProfileImage from '../components/ProfileImage';

const TestProfileImagePage: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile || !e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    setUploadError('');
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${profile.id}/profile/${Date.now()}.${fileExt}`;
    
    try {
      console.log('Starting image upload for user:', profile.id);
      console.log('File path:', filePath);
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true });
        
      if (uploadError) {
        console.error('Upload error:', uploadError);
        setUploadError('Upload failed: ' + uploadError.message);
        setUploading(false);
        return;
      }
      
      console.log('Upload successful:', uploadData);
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);
        
      const publicUrl = urlData.publicUrl;
      console.log('Public URL generated:', publicUrl);
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_image_url: publicUrl })
        .eq('id', profile.id);
        
      if (updateError) {
        console.error('Profile update error:', updateError);
        setUploadError('Failed to update profile: ' + updateError.message);
        setUploading(false);
        return;
      }
      
      console.log('Profile updated successfully');
      setProfile(prev => prev ? { ...prev, profile_image_url: publicUrl } : prev);
      setUploadError('');
      
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setUploadError('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!profile) {
    return <div className="p-8">No profile found. Please log in.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Profile Image Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Role:</strong> {profile.role}</p>
            </div>
            <div>
              <p><strong>Profile Image URL:</strong></p>
              <p className="text-sm text-gray-600 break-all">
                {profile.profile_image_url || 'No image URL'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Profile Image Display</h2>
          <div className="flex flex-wrap gap-8">
            <div className="text-center">
              <h3 className="font-medium mb-2">Small</h3>
              <ProfileImage imageUrl={profile.profile_image_url} size="sm" />
            </div>
            <div className="text-center">
              <h3 className="font-medium mb-2">Medium</h3>
              <ProfileImage imageUrl={profile.profile_image_url} size="md" />
            </div>
            <div className="text-center">
              <h3 className="font-medium mb-2">Large</h3>
              <ProfileImage imageUrl={profile.profile_image_url} size="lg" />
            </div>
            <div className="text-center">
              <h3 className="font-medium mb-2">Extra Large</h3>
              <ProfileImage imageUrl={profile.profile_image_url} size="xl" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Upload New Image</h2>
          <div className="flex items-center space-x-4">
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded cursor-pointer">
              Choose File
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
            {uploading && <span className="text-blue-600">Uploading...</span>}
            {uploadError && <span className="text-red-600">{uploadError}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestProfileImagePage; 