from io import BytesIO

import numpy as np
import pytest
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, ImplicitVRLittleEndian

from virtuapet_dicom import DicomRejected, reconstruct_ct


def instance(z, **changes):
    meta = FileMetaDataset()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    meta.MediaStorageSOPClassUID = CTImageStorage
    meta.MediaStorageSOPInstanceUID = f"1.2.826.0.1.3680043.10.999.{int(z)+1}"
    ds = FileDataset(None, {}, file_meta=meta, preamble=b'\0' * 128)
    ds.SOPClassUID, ds.SOPInstanceUID = meta.MediaStorageSOPClassUID, meta.MediaStorageSOPInstanceUID
    ds.PatientID = 'SYNTHETIC'
    ds.StudyInstanceUID, ds.SeriesInstanceUID, ds.FrameOfReferenceUID = '1.2.3', '1.2.3.4', '1.2.3.5'
    ds.Modality = 'CT'
    ds.Rows, ds.Columns = 2, 3
    ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, 'MONOCHROME2'
    ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 16, 15, 1
    ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
    ds.ImagePositionPatient = [10, 20, z]
    ds.PixelSpacing = [2, 3]
    ds.SliceThickness = 0.5  # Deliberately differs from actual center spacing.
    ds.RescaleSlope, ds.RescaleIntercept, ds.RescaleType = 2, -1000, 'HU'
    ds.PixelData = np.array([[-2, 0, 1], [2, 3, 4]], dtype='<i2').tobytes()
    for key, value in changes.items():
        if key == 'TransferSyntaxUID':
            ds.file_meta.TransferSyntaxUID = value
        else:
            setattr(ds, key, value)
    out = BytesIO()
    ds.save_as(out, enforce_file_format=True)
    return out.getvalue()


def test_real_pixels_sorted_and_affine_uses_spacing_not_thickness():
    a, b = instance(0), instance(2)
    v = reconstruct_ct([b, a])
    np.testing.assert_array_equal(v.voxels_hu[0], [[-1004, -1000, -998], [-996, -994, -992]])
    np.testing.assert_array_equal(v.affine_lps @ [2, 1, 1, 1], [16, 22, 2, 1])
    np.testing.assert_array_equal(v.affine_ras @ [2, 1, 1, 1], [-16, -22, 2, 1])
    assert v.source_sha256 == reconstruct_ct([a, b]).source_sha256
    assert not v.voxels_hu.flags.writeable


def test_oblique_plane_and_implicit_syntax():
    changes = dict(ImageOrientationPatient=[0, 1, 0, 0, 0, 1], TransferSyntaxUID=ImplicitVRLittleEndian)
    v = reconstruct_ct([instance(0, ImagePositionPatient=[10, 20, 30], **changes),
                        instance(2, ImagePositionPatient=[12, 20, 30], **changes)])
    np.testing.assert_array_equal(v.affine_lps @ [2, 1, 1, 1], [12, 26, 32, 1])


@pytest.mark.parametrize('changes,code', [
    ({'PatientID': 'OTHER'}, 'series_mismatch'),
    ({'FrameOfReferenceUID': '1.2.9'}, 'series_mismatch'),
    ({'Modality': 'MR'}, 'classic_ct_required'),
    ({'AnatomicalOrientationType': 'QUADRUPED'}, 'quadruped_mapping_required'),
    ({'NumberOfFrames': 2}, 'multiframe_unsupported'),
    ({'PixelSpacing': [0, 1]}, 'invalid_spacing'),
    ({'ImageOrientationPatient': [1, 0, 0, 1, 0, 0]}, 'invalid_orientation'),
    ({'ImagePositionPatient': [11, 20, 2]}, 'gantry_tilt_unsupported'),
    ({'ImagePositionPatient': [10, 20, 0]}, 'duplicate_plane'),
    ({'PixelData': b'\0\0'}, 'pixel_length_mismatch'),
    ({'RescaleSlope': 0}, 'invalid_rescale'),
    ({'RescaleType': 'US'}, 'hu_units_required'),
    ({'PixelPaddingValue': -2000}, 'intensity_transform_unsupported'),
    ({'PixelSpacing': [1, 1]}, 'inconsistent_geometry'),
])
def test_rejections(changes, code):
    with pytest.raises(DicomRejected, match=f'^{code}$'):
        reconstruct_ct([instance(0), instance(2, **changes)])


def test_irregular_gap_and_duplicates():
    with pytest.raises(DicomRejected, match='irregular_spacing'):
        reconstruct_ct([instance(0), instance(2), instance(5)])
    with pytest.raises(DicomRejected, match='duplicate_instance'):
        reconstruct_ct([instance(0), instance(0)])


def test_caps_and_redacted_parse_errors():
    data = [instance(0), instance(2)]
    with pytest.raises(DicomRejected, match='input_byte_limit'):
        reconstruct_ct(data, max_input_bytes=1)
    with pytest.raises(DicomRejected, match='voxel_limit'):
        reconstruct_ct(data, max_voxels=2)
    with pytest.raises(DicomRejected, match='part10_required'):
        reconstruct_ct([b'PRIVATE PATIENT', data[0]])
    with pytest.raises(DicomRejected, match='invalid_dicom'):
        reconstruct_ct([b'\0' * 128 + b'DICM', data[0]])


def test_per_slice_rescale_and_truncated_data():
    v = reconstruct_ct([instance(0), instance(2, RescaleSlope=1, RescaleIntercept=10)])
    assert v.voxels_hu[1, 0, 0] == 8
    with pytest.raises(DicomRejected, match='invalid_dicom|pixel_length_mismatch'):
        reconstruct_ct([instance(0), instance(2)[:-4]])


def test_nonfinite_position():
    with pytest.raises(DicomRejected, match='invalid_geometry|invalid_dicom'):
        reconstruct_ct([instance(0), instance(2, ImagePositionPatient=[10, 20, float('nan')])])


def test_different_orientation_and_missing_patient():
    with pytest.raises(DicomRejected, match='inconsistent_geometry'):
        reconstruct_ct([instance(0), instance(2, ImageOrientationPatient=[0, 1, 0, 0, 0, 1])])
    with pytest.raises(DicomRejected, match='identity_required'):
        reconstruct_ct([instance(0), instance(2, PatientID='')])
