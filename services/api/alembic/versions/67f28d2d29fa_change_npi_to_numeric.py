"""change_npi_to_numeric

Revision ID: e5f629a4e123
Revises: 
Create Date: 2024-02-19 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e5f629a4e123'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create a temporary column
    op.add_column('providers', sa.Column('npi_numeric', sa.BigInteger(), nullable=True))
    
    # Copy data from the old column to the new column, converting string to numeric
    op.execute("""
        UPDATE providers 
        SET npi_numeric = CAST(npi AS BIGINT) 
        WHERE npi ~ '^[0-9]{10}$'
    """)
    
    # Drop the old column
    op.drop_column('providers', 'npi')
    
    # Rename the new column to the original name
    op.alter_column('providers', 'npi_numeric', new_column_name='npi')
    
    # Add constraints
    op.create_check_constraint(
        'npi_length_check',
        'providers',
        'npi >= 1000000000 AND npi <= 9999999999'
    )
    op.create_unique_constraint('uq_providers_npi', 'providers', ['npi'])
    op.alter_column('providers', 'npi', nullable=False)

def downgrade():
    # Remove constraints
    op.drop_constraint('npi_length_check', 'providers')
    op.drop_constraint('uq_providers_npi', 'providers')
    
    # Create a temporary column
    op.add_column('providers', sa.Column('npi_string', sa.String(10), nullable=True))
    
    # Copy data back to string format
    op.execute("""
        UPDATE providers 
        SET npi_string = LPAD(npi::text, 10, '0')
    """)
    
    # Drop the numeric column
    op.drop_column('providers', 'npi')
    
    # Rename the string column back
    op.alter_column('providers', 'npi_string', new_column_name='npi')
    
    # Add back original constraints
    op.create_unique_constraint('uq_providers_npi', 'providers', ['npi'])
    op.alter_column('providers', 'npi', nullable=False)